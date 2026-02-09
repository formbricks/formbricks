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

  private async run(): Promise<void> {
    this.running = true;

    while (this.queue.length > 0) {
      let didExecute = false;
      let movedSetup = false;

      // Iterate through the queue to find the first runnable command
      for (let i = 0; i < this.queue.length; i++) {
        const currentItem = this.queue[i];

        if (!currentItem) {
          this.queue.splice(i, 1);
          i--;
          continue;
        }

        // CHECK SETUP REQUIREMENT
        if (currentItem.checkSetup) {
          const setupResult = checkSetup();
          if (!setupResult.ok) {
            // Command needs setup, but we are not set up.
            // Look ahead for a Setup command to prioritize
            // We only search for setup commands AFTER the current blocked item
            const setupCommandIndex = this.queue.findIndex(
              (item, index) => index > i && item.type === CommandType.Setup
            );

            if (setupCommandIndex !== -1 && setupCommandIndex > 0) {
              // Found a setup command! Move it to the FRONT (index 0)
              const setupCommand = this.queue.splice(setupCommandIndex, 1)[0];
              this.queue.unshift(setupCommand);

              movedSetup = true;
              // Break inner loop to restart scanning from index 0 immediately
              break;
            }

            // No setup command found. This item is BLOCKED.
            // SKIP IT and continue searching for independent work.
            continue;
          }
        }

        // IF WE REACH HERE, COMMAND IS RUNNABLE
        // Remove from queue
        this.queue.splice(i, 1);

        // Execute logic
        if (currentItem.type === CommandType.GeneralAction) {
          const updateQueue = UpdateQueue.getInstance();
          if (!updateQueue.isEmpty()) {
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

        // We executed something!
        didExecute = true;

        // Restart search from the beginning (index 0) to preserve priority/order
        break;
      }

      // STARVATION PROTECTION
      // If we iterated the whole queue and executed nothing AND didn't move any setup command,
      // then we are truly stalled (all remaining items are blocked).
      if (!didExecute && !movedSetup) {
        // All remaining commands are blocked; exit to avoid deadlock
        break;
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
