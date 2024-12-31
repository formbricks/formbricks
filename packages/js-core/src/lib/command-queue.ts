import { wrapThrowsAsync } from "@formbricks/types/error-handlers";
import { ErrorHandler, type Result } from "./errors";
import { checkInitialized } from "./initialize";

// Define a base type for acceptable return types
type CommandReturnType = Promise<Result<void, unknown>> | Result<void, unknown> | Promise<void>;

// Define a type for functions that return our accepted return types
type CommandFunction<Args extends unknown[] = unknown[]> = (...args: Args) => CommandReturnType;

type TArgs = unknown[];

// Define a queue item type that's generic over the function and its arguments
interface QueueItem<F extends CommandFunction> {
  command: F;
  checkInitialized: boolean;
  commandArgs: Parameters<F>;
}

export class CommandQueue {
  private queue: QueueItem<CommandFunction>[] = [];
  private running = false;
  private resolvePromise: (() => void) | null = null;
  private commandPromise: Promise<void> | null = null;

  // Make add generic over the function type and its parameters
  public add<Args extends TArgs>(
    checkInitializedArg: boolean,
    command: CommandFunction<Args>,
    ...args: Args
  ): void {
    this.queue.push({
      command: command as CommandFunction,
      checkInitialized: checkInitializedArg,
      commandArgs: args,
    });

    if (!this.running) {
      this.commandPromise = new Promise((resolve) => {
        this.resolvePromise = resolve;
        void this.run();
      });
    }
  }

  public async wait(): Promise<void> {
    if (this.running) {
      await this.commandPromise;
    }
  }

  private async run(): Promise<void> {
    this.running = true;

    while (this.queue.length > 0) {
      const errorHandler = ErrorHandler.getInstance();
      const currentItem = this.queue.shift();
      if (!currentItem) continue;

      if (currentItem.checkInitialized) {
        const initResult = checkInitialized();
        if (!initResult.ok) {
          errorHandler.handle(initResult.error);
          continue;
        }
      }

      const executeCommand = async (): Promise<Result<void, unknown>> => {
        return (await currentItem.command.apply(null, currentItem.commandArgs)) as Result<void, unknown>;
      };

      const result = await wrapThrowsAsync(executeCommand)();

      if (result.ok) {
        if (!result.data.ok) {
          errorHandler.handle(result.data.error);
        }
      }
      if (!result.ok) {
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
