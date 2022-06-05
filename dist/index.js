var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  Actor: () => Actor,
  createLocalThreadPool: () => createLocalThreadPool
});
module.exports = __toCommonJS(src_exports);
var threads = [];
var nextThread = 0;
var actorFunctions = {};
function createLocalThreadPool(webWorkerModule, count = 4) {
  for (let i = 0; i < count; i++) {
    threads.push(new webWorkerModule());
  }
}
function Actor(actorId, f) {
  registerActor(actorId, f);
  return {
    async spawnRemote(...args) {
      if (!threads.length) {
        throw new Error("Thread pool must be initialized with `createLocalThreadPool` first");
      }
      const thread = threads[nextThread];
      nextThread = (nextThread + 1) % threads.length;
      const resolvers = {};
      const { port1, port2 } = new MessageChannel();
      const spawnEvent = { actorId, args, port1 };
      thread.postMessage(spawnEvent, [port1]);
      await new Promise((res, rej) => {
        port2.onmessage = (event) => {
          const data = event.data;
          if (data.error) {
            rej(data.error);
          } else {
            res();
          }
        };
      });
      port2.onmessage = async (event) => {
        const data = event.data;
        const resolver = resolvers[data.callId];
        if (!resolver) {
          console.error(`Failed to find actor resolver for call ${data.callId}`);
          return;
        }
        if (data.error) {
          resolver.reject(data.error);
        } else {
          resolver.resolve(data.response);
        }
        delete resolvers[data.callId];
      };
      let nextCallId = 0;
      return new Proxy({}, {
        get(_target, propKey, _receiver) {
          if (propKey === "then") {
            return;
          }
          return function(...args2) {
            const callId = nextCallId++;
            const reqEvent = {
              callId,
              method: propKey,
              args: args2
            };
            const promise = new Promise((resolve, reject) => {
              resolvers[callId] = { resolve, reject };
            });
            port2.postMessage(reqEvent);
            return promise;
          };
        }
      });
    },
    spawnLocal(...args) {
      return f(...args);
    }
  };
}
function registerActor(actorId, f) {
  actorFunctions[actorId] = f;
  if (self.onmessage) {
    return;
  }
  self.onmessage = async (event) => {
    if (!event.isTrusted) {
      return;
    }
    const data = event.data;
    const f2 = actorFunctions[data.actorId];
    if (!f2) {
      console.error('No Actor named "', data.actorId, '" registered.');
      return;
    }
    let actorMethods;
    try {
      actorMethods = await f2(...data.args);
    } catch (e) {
      const result = { error: e };
      data.port1.postMessage(result);
      return;
    }
    data.port1.onmessage = async (event2) => {
      const call = event2.data;
      const respEvent = {
        callId: call.callId,
        response: null
      };
      try {
        respEvent.response = await actorMethods[call.method].call(actorMethods, ...call.args);
      } catch (e) {
        respEvent.error = e;
      }
      data.port1.postMessage(respEvent);
    };
    data.port1.postMessage({});
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Actor,
  createLocalThreadPool
});
//# sourceMappingURL=index.js.map