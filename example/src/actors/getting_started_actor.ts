import { Actor } from '@athilenius/simple-webworker-actors';

// Actors are defined a wrapped functions.
export const GettingStartedActor = Actor(
  // All actors need a globally unique identifier. This can be any string, but
  // must be unique within the compiled module(s) loaded into the WebWorker.
  // This only exists because of the limited RTTI in JavaScript.
  'counter-actor',

  // This is the actual actor. It can take in any number of typed arguments, and
  // returns an object with methods. Any of those methods are callable remotely.
  // The actor function can itself be async if you need.
  (initialValue: number) => {
    // The actor's "state" is simply the closed over state of the function.
    // Global state should generally be avoided as it's local to the WebWorker
    // that happens to be hosting the Actor.
    let value = initialValue;

    // Return back an object with methods. Each method can have any number of
    // typed arguments, can be async, and can optionally return a value.
    return {
      heavyWeightOperation() {
        // Spin-lock the thread for a while. This will not block the main thread
        // as long as the actor is spawned remotely (into a WebWorker).
        for (let i = 0; i < 10_000_000; i++) {
          value += Math.random() - 0.5;
        }

        return value;
      },
    };
  }
);
