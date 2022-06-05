import { createLocalThreadPool } from '@athilenius/simple-webworker-actors';
import { GettingStartedActor } from './actors/getting_started_actor';

// In Vite, you can code-split a module and wrap it in a WebWorker by simply
// appending ?worker to the import. If you're using TypeScript you'll also
// need a type declaration to keep the compiler happy (see types.d.ts)
import WebworkerModule from './actors/module?worker';
import { SearchIndexActor } from './actors/search_index_actor';

async function main() {
  // Start by creating a thread pool. This will create N WebWorkers which can
  // each host any number of Actors (round-robbin dispatch). The code-split
  // module is what is 'run' in each WebWorker, so the Actors it can spawn is
  // limited to those within the module (in our case the contents of
  // src/actors/module.ts)
  createLocalThreadPool(WebworkerModule, navigator.hardwareConcurrency);

  // Then you can spawn remote actors by simply calling `spawnRemote` with the
  // typed arguments from the actor's definition. If the actor function throws,
  // then this will too.
  const remoteActor = await GettingStartedActor.spawnRemote(42);

  // Message passing is as simple as calling methods on the ES6 proxy that
  // `spawnRemote` returns. Again, this is fully typed.
  const value = await remoteActor.heavyWeightOperation();
  console.log(value);

  // Actors can also be spawned locally, in the current thread. This is only
  // useful for I/O bound tasks, or as an organizational tool.
  const localActor = GettingStartedActor.spawnLocal(42);

  // Local actors will block the current thread when doing computationally
  // expensive worker. Making them of very limited use.
  const blockedMainThread = localActor.heavyWeightOperation();
  console.log(blockedMainThread);

  // As many remote actors can be spawned as you like, but they live until the
  // page is refreshed/closed. This will run the `heavyWeightOperation` on 4
  // threads.
  let start = performance.now();
  await Promise.all(
    [...Array(4)].map(async (_) => {
      const actor = await GettingStartedActor.spawnRemote(42);
      return await actor.heavyWeightOperation();
    })
  );

  console.log('Remote running took', performance.now() - start, 'ms');

  // And this runs it all locally.
  start = performance.now();
  [...Array(4)].map(async (_) => {
    const actor = GettingStartedActor.spawnLocal(42);
    return actor.heavyWeightOperation();
  });

  console.log('Local running took', performance.now() - start, 'ms');

  // Finally, let's create a more useful Actor, one that indexes a large JSON
  // document and allows us to full-text search a field in it without ever
  // impacting the main thread.
  const searchIndexActor = await SearchIndexActor.spawnRemote(
    'https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json',
    'name'
  );

  const searchResult = await searchIndexActor.search('boulder');
  console.log(searchResult[0]);
}

void main();

// Output:
/*
main.ts:26 -138.2341345803527
main.ts:35 -546.3403868526417
main.ts:48 Remote running took 294.4000000357628 ms
main.ts:57 Local running took 874.8999999761581 ms
main.ts:68
{web_pages: Array(1), name: 'University of Colorado at Boulder', alpha_two_code: 'US', state-province: null, domains: Array(1), …}
alpha_two_code: "US"
country: "United States"
domains: ['colorado.edu']
name: "University of Colorado at Boulder"
state-province: null
web_pages: ['http://www.colorado.edu/']
[[Prototype]]: Object
*/
