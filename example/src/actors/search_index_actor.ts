import { Actor } from '@athilenius/simple-webworker-actors';
import { Index } from 'flexsearch';
import _ from 'lodash';

export const SearchIndexActor = Actor(
  'search-index',
  async (jsonUrl: string, fieldPath: string) => {
    const resp = await fetch(jsonUrl);
    const data: any[] = await resp.json();

    // There are other ways to use Flex Search, I'm using it a little obtuse
    // here for the example.
    const index = new Index('match');

    // This is a heavy operation for large datasets.
    data.map((obj, i) => index.add(i, _.get(obj, fieldPath)));

    return {
      search(text: string): any[] {
        // We can simply run the synchronous version of the search because we
        // aren't concerned with blocking the main thread.
        return index.search(text).map((id) => data[id as number]);
      },
    };
  }
);
