import { wrapThrowsAsync } from "@formbricks/types/error-handlers";
import { type TJsPackageType } from "@formbricks/types/js";
import { ErrorHandler, type Result } from "../../../js-core/src/shared/errors";
import { checkInitialized } from "./initialize";

export class CommandQueue {
  private queue: {
    command: (...args: any[]) => Promise<Result<void, unknown>> | Result<void, unknown> | Promise<void>;
    packageType: TJsPackageType;
    checkInitialized: boolean;
    commandArgs: any[];
  }[] = [];
  private running = false;
  private resolvePromise: (() => void) | null = null;
  private commandPromise: Promise<void> | null = null;

  public add<A>(
    packageType: TJsPackageType,
    command: (...args: A[]) => Promise<Result<void, unknown>> | Result<void, unknown> | Promise<void>,
    shouldCheckInitialized = true,
    ...args: A[]
  ): void {
    this.queue.push({ command, checkInitialized: shouldCheckInitialized, commandArgs: args, packageType });

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

      // make sure formbricks is initialized
      if (currentItem.checkInitialized) {
        // call different function based on package type
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

      if (!result.ok) {
        errorHandler.handle(result.error);
      } else if (!result.data.ok) {
        errorHandler.handle(result.data.error);
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
