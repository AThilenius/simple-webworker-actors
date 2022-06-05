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
