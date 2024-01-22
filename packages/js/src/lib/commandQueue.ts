import { wrapThrowsAsync } from "@formbricks/types/errorHandlers";

import { ErrorHandler, Result } from "./errors";
import { checkInitialized } from "./initialize";

export class CommandQueue {
  private queue: {
    command: (args: any) => Promise<Result<void, any>> | Result<void, any> | Promise<void>;
    checkInitialized: boolean;
    commandArgs: any[any];
  }[] = [];
  private running: boolean = false;
  private resolvePromise: (() => void) | null = null;
  private commandPromise: Promise<void> | null = null;

  public add<A>(
    checkInitialized: boolean = true,
    command: (...args: A[]) => Promise<Result<void, any>> | Result<void, any> | Promise<void>,
    ...args: A[]
  ) {
    this.queue.push({ command, checkInitialized, commandArgs: args });

    if (!this.running) {
      this.commandPromise = new Promise((resolve) => {
        this.resolvePromise = resolve;
        this.run();
      });
    }
  }

  public async wait() {
    if (this.running) {
      await this.commandPromise;
    }
  }

  private async run() {
    this.running = true;
    while (this.queue.length > 0) {
      const errorHandler = ErrorHandler.getInstance();
      const currentItem = this.queue.shift();

      if (!currentItem) continue;

      // make sure formbricks is initialized
      if (currentItem.checkInitialized) {
        const initResult = checkInitialized();

        if (initResult && initResult.ok !== true) errorHandler.handle(initResult.error);
      }

      const executeCommand = async () => {
        return (await currentItem?.command.apply(null, currentItem?.commandArgs)) as Result<void, any>;
      };

      const result = await wrapThrowsAsync(executeCommand)();

      if (!result) continue;

      if (result.ok) {
        if (result.data && !result.data.ok) {
          errorHandler.handle(result.data.error);
        }
      }

      if (result.ok !== true) {
        errorHandler.handle(result.error);
      }
    }
    this.running = false;
    if (this.resolvePromise) {
      this.resolvePromise();
      this.resolvePromise = null;
      this.commandPromise = null;
    }
  }
}
