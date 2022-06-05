# Simple WebWorker Actors

**Check out the `/examples` directory; run `cd example && yarn && yarn dev` to
start the example.**

## A TS actor (multi-threading) library with the priorities...

1. Simplicity above all else
2. Strong, end-to-end typing
3. Standard module syntax support via code-splitting
4. Simple thread pool usage

## Install

```sh
yarn add @athilenius/simple-webworker-actors
```

## Usage

Start by defining the actor, which is just a wrapped function that returns an
object with named methods.

`basic_actor.ts`

```ts
import { Actor } from '@athilenius/simple-webworker-actors';

// We can freely use imports. They will be included in the module used by
// WebWorkers.
import _ from 'lodash';

export const BasicActor = Actor(
  'basic-actor',
  async (anyArgs: number, can: { go: string }, here: boolean) => {
    let counter = 0;

    return {
      someActorMethod(messageArgs: number): string {
        counter += _.add(anyArgs, can.go.length + (here ? messageArgs : -1));
        return `Methods can optionally return values: ${counter}`;
      },
    };
  }
);
```

Create a top-level 'module' file that imports all our Actors.

`module.ts`

```ts
import './basic_actor';
```

Then use them!

`main.ts`

```ts
import { createLocalThreadPool } from '@athilenius/simple-webworker-actors';
import { BasicActor } from './basic_actor';

// Use Vite's code-splitting to create a module for the WebWorkers.
import WebworkerModule from './actors/module?worker';

async function main() {
  createLocalThreadPool(WebworkerModule, navigator.hardwareConcurrency);
  const actor = await BasicActor.spawnRemote(42, { go: '2' }, false);
  console.log(await actor.someActorMethod(1));
}

void main();
```

---

## Why? How?

There are a bunch of Actor libraries already out there for JavaScript, and one
of them may very well suit your needs better than this library (which is
purposefully feature-lite). However, none seemed to combine simplicity with
strong typing, or had limitations I was unwilling to live with like no module
support, meaning no third-party library use. This library fills my own little
niche need, and it seemed 'decent enough' to open source.

The **how** is pretty simple, it's 210 lines of TypeScript and much of that is
just (admittedly complicated) typing definitions so I encourage just reading
through the source. Factories are spawned in WebWorkers and Actors are spawned
(invoked) by those factories via the standard message-passing mechanism.
Individual actor messages are then sent over a per-actor `MessageChannel`. The
local 'remote control' object used to send messages to an actor is a simple ES6
proxy.

## How do I...

> Terminate/free an actor?

You can't, they live for the lifetime of the WebWorker. Lifecycle events add
more complexity than I care to take on. Ie. dropping the local 'remote control'
reference to the actor will not free the actor on the service worker thread, it
will simply be orphaned. However, locally spawned actors return the actor object
itself, so are scoped like any other JS object.

## Contributing

Please open an issue if you find a bug! And thank you ❤️ Feature requests are
also welcome, but do keep the #1 stated objective of this library in mind.

## License

Dual-license under MIT or Apache V2, which ever you prefer.
