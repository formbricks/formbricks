/* eslint-disable no-console -- we need to log global errors */
import { checkInitialized } from "@/lib/common/initialize";
import { wrapThrowsAsync } from "@/lib/common/utils";
import type { Result } from "@/types/error";

export class CommandQueue {
  private queue: {
    command: (...args: any[]) => Promise<Result<void, unknown>> | Result<void, unknown> | Promise<void>;
    checkInitialized: boolean;
    commandArgs: any[];
  }[] = [];
  private running = false;
  private resolvePromise: (() => void) | null = null;
  private commandPromise: Promise<void> | null = null;

  public add<A>(
    command: (...args: A[]) => Promise<Result<void, unknown>> | Result<void, unknown> | Promise<void>,
    shouldCheckInitialized = true,
    ...args: A[]
  ): void {
    this.queue.push({ command, checkInitialized: shouldCheckInitialized, commandArgs: args });

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
      const currentItem = this.queue.shift();

      if (!currentItem) continue;

      // make sure formbricks is initialized
      if (currentItem.checkInitialized) {
        // call different function based on package type
        const initResult = checkInitialized();

        if (!initResult.ok) {
          continue;
        }
      }

      const executeCommand = async (): Promise<Result<void, unknown>> => {
        return (await currentItem.command.apply(null, currentItem.commandArgs)) as Result<void, unknown>;
      };

      const result = await wrapThrowsAsync(executeCommand)();

      if (!result.ok) {
        console.error("🧱 Formbricks - Global error: ", result.error);
      } else if (!result.data.ok) {
        console.error("🧱 Formbricks - Global error: ", result.data.error);
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
