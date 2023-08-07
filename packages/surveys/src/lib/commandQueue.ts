import { ErrorHandler, Result } from "./errors";
import { checkInitialized } from "./init";

export class CommandQueue {
  private queue: {
    command: (args: any) => Promise<Result<void, any>> | Result<void, any>;
    checkInitialized: boolean;
    commandArgs: any[];
  }[] = [];
  private running: boolean = false;
  private resolvePromise: (() => void) | null = null;
  private commandPromise: Promise<void> | null = null;

  public add<A>(
    checkInitialized: boolean = true,
    command: (...args: A[]) => Promise<Result<void, any>> | Result<void, any>,
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

      // make sure formbricks is initialized
      if (currentItem.checkInitialized) {
        const initResult = checkInitialized();

        if (initResult && initResult.ok !== true) errorHandler.handle(initResult.error);
      }

      const result = (await currentItem.command.apply(null, currentItem.commandArgs)) as Result<void, any>;

      if (!result) continue;

      if (result.ok !== true) errorHandler.handle(result.error);
    }
    this.running = false;
    if (this.resolvePromise) {
      this.resolvePromise();
      this.resolvePromise = null;
      this.commandPromise = null;
    }
  }
}
