type Fn = (...args: any) => any;

const threads: Worker[] = [];
let nextThread = 0;
const actorFunctions: { [key: string]: Fn } = {};

export function createLocalThreadPool(
  webWorkerModule: new () => Worker,
  count = 4
) {
  for (let i = 0; i < count; i++) {
    threads.push(new webWorkerModule());
  }
}

export interface Actor<F extends Fn, R = ReturnType<F>, A = Awaited<R>> {
  spawnRemote(...args: Parameters<F>): Promise<{
    [Property in keyof A as A[Property] extends Fn
      ? Property
      : never]: A[Property] extends Fn
      ? (
          ...args: Parameters<A[Property]>
        ) => Promise<Awaited<ReturnType<A[Property]>>>
      : never;
  }>;
  spawnLocal(...args: Parameters<F>): R;
}

export function Actor<F extends Fn>(actorId: string, f: F): Actor<F> {
  registerActor(actorId, f);

  return {
    async spawnRemote(...args: any[]) {
      // Get the next thread round-robin
      if (!threads.length) {
        throw new Error(
          'Thread pool must be initialized with `createLocalThreadPool` first'
        );
      }

      const thread = threads[nextThread];
      nextThread = (nextThread + 1) % threads.length;

      // Resolvers are local to an actor instance, because they use
      // MessageChannels.
      const resolvers: {
        [callId: number]: {
          resolve: (retVal: any) => void;
          reject: (err: any) => void;
        };
      } = {};

      // Spawn the actor remotely, send actor details, ctor args, and
      // MessageChannel port it should us.
      const { port1, port2 } = new MessageChannel();

      // Send the port via transfer, see:
      // https://developer.mozilla.org/en-US/docs/Glossary/Transferable_objects
      const spawnEvent: ActorSpawnEvent = { actorId, args, port1 };
      thread.postMessage(spawnEvent, [port1]);

      // Wait for the first message to be received, it will always be the
      // results of calling the actor itself.
      await new Promise<void>((res, rej) => {
        port2.onmessage = (event) => {
          const data = event.data as ActorSpawnResult;
          if (data.error) {
            rej(data.error);
          } else {
            res();
          }
        };
      });

      // Handle the rest of the messages, which will all be call responses.
      port2.onmessage = async (event) => {
        const data = event.data as ActorResponseEvent;

        // Find the resolver and complete it.
        const resolver = resolvers[data.callId];
        if (!resolver) {
          console.error(
            `Failed to find actor resolver for call ${data.callId}`
          );
          return;
        }
        if (data.error) {
          resolver.reject(data.error);
        } else {
          resolver.resolve(data.response);
        }

        delete resolvers[data.callId];
      };

      // Finally, return an ES6 proxy that translates method calls into messages
      // over the MessageChannel port2.
      let nextCallId = 0;
      return new Proxy(
        {},
        {
          get(_target: any, propKey: string, _receiver: any) {
            // Ignore await on the proxy itself.
            if (propKey === 'then') {
              return;
            }

            return function (...args: any[]) {
              const callId = nextCallId++;
              const reqEvent: ActorCallEvent = {
                callId,
                method: propKey,
                args,
              };

              const promise = new Promise((resolve, reject) => {
                resolvers[callId] = { resolve, reject };
              });

              port2.postMessage(reqEvent);

              return promise;
            };
          },
        }
      );
    },

    spawnLocal(...args: any[]) {
      return f(...args);
    },
  };
}

function registerActor(actorId: string, f: Fn) {
  actorFunctions[actorId] = f;

  // Also register the thread-local messages handler if it isn't already
  // registered. This only handles actor spawn events, all other events are sent
  // over a MessageChannel.
  if (self.onmessage) {
    return;
  }

  self.onmessage = async (event) => {
    if (!event.isTrusted) {
      return;
    }

    const data = event.data as ActorSpawnEvent;
    const f = actorFunctions[data.actorId];

    if (!f) {
      console.error('No Actor named "', data.actorId, '" registered.');
      return;
    }

    let actorMethods: any;
    try {
      actorMethods = await f(...data.args);
    } catch (e) {
      const result: ActorSpawnResult = { error: e };
      data.port1.postMessage(result);
      return;
    }

    // Handle inbound message on port1
    data.port1.onmessage = async (event) => {
      const call = event.data as ActorCallEvent;
      const respEvent: ActorResponseEvent = {
        callId: call.callId,
        response: null,
      };
      try {
        respEvent.response = await actorMethods[call.method].call(
          actorMethods,
          ...call.args
        );
      } catch (e) {
        respEvent.error = e;
      }
      data.port1.postMessage(respEvent);
    };

    // All done
    data.port1.postMessage({});
  };
}

interface ActorSpawnEvent {
  actorId: string;
  args: any[];
  port1: MessagePort;
}

interface ActorSpawnResult {
  error?: any;
}

interface ActorCallEvent {
  callId: number;
  method: string;
  args: any[];
}

interface ActorResponseEvent {
  callId: number;
  response: any;
  error?: any;
}
