/* eslint-disable @typescript-eslint/no-explicit-any -- required for command queue */
/* eslint-disable no-console -- we need to log global errors */
import { checkSetup } from "@/lib/common/status";
import { wrapThrowsAsync } from "@/lib/common/utils";
import { UpdateQueue } from "@/lib/user/update-queue";
import { type Result } from "@/types/error";

export type TCommand = (
  ...args: any[]
) => Promise<Result<void, unknown>> | Result<void, unknown> | Promise<void>;

export enum CommandType {
  Setup,
  UserAction,
  GeneralAction,
}

interface InternalQueueItem {
  command: TCommand;
  type: CommandType;
  checkSetup: boolean;
  commandArgs: any[];
}

export class CommandQueue {
  private queue: InternalQueueItem[] = [];
  private running = false;
  private resolvePromise: (() => void) | null = null;
  private commandPromise: Promise<void> | null = null;
  private static instance: CommandQueue | null = null;

  public static getInstance(): CommandQueue {
    CommandQueue.instance ??= new CommandQueue();
    return CommandQueue.instance;
  }

  public add(
    command: TCommand,
    type: CommandType,
    shouldCheckSetupFlag = true,
    ...args: any[]
  ): Promise<Result<void, unknown>> {
    return new Promise((addResolve) => {
      try {
        const newItem: InternalQueueItem = {
          command,
          type,
          checkSetup: shouldCheckSetupFlag,
          commandArgs: args,
        };

        this.queue.push(newItem);

        if (!this.running) {
          this.commandPromise = new Promise((resolve) => {
            this.resolvePromise = resolve;
            void this.run();
          });
        }

        addResolve({ ok: true, data: undefined });
      } catch (error) {
        addResolve({ ok: false, error: error as Error });
      }
    });
  }

  public async wait(): Promise<void> {
    if (this.running) {
      await this.commandPromise;
    }
  }

  public isRunning(): boolean {
    return this.running;
  }

  public hasPending(): boolean {
    return this.queue.length > 0;
  }

  /**
   * Resume queue processing if the queue has pending items but is not running.
   * Call this when external state changes (e.g. setup completion) may unblock
   * previously paused commands.
   */
  public resumeIfPaused(): void {
    if (!this.running && this.queue.length > 0) {
      this.commandPromise = new Promise((resolve) => {
        this.resolvePromise = resolve;
        void this.run();
      });
    }
  }

  private async run(): Promise<void> {
    this.running = true;

    // Track how many commands in a row have failed the setup check.
    // When consecutiveFailures >= queue.length, every item is blocked — exit.
    let consecutiveFailures = 0;

    while (this.queue.length > 0 && consecutiveFailures < this.queue.length) {
      const currentItem = this.queue.shift();

      if (!currentItem) continue;

      if (currentItem.checkSetup) {
        const setupResult = checkSetup();
        if (!setupResult.ok) {
          // Preserve the command — push it to the back so it can be retried
          // once setup completes via resumeIfPaused().
          console.warn(`🧱 Formbricks - Setup not complete. Pausing command.`);
          this.queue.push(currentItem);
          consecutiveFailures++;
          continue;
        }
      }

      // Command will execute — reset the failure streak.
      consecutiveFailures = 0;

      if (currentItem.type === CommandType.GeneralAction) {
        // first check if there are pending updates in the update queue
        const updateQueue = UpdateQueue.getInstance();
        if (!updateQueue.isEmpty()) {
          console.log("🧱 Formbricks - Waiting for pending updates to complete before executing command");
          await updateQueue.processUpdates();
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
