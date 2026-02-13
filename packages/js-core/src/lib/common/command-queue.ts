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

  async run(): Promise<void> {
    if (this.running) return;

    this.running = true;

    try {
      while (this.queue.length > 0) {
        // Peek at the next command instead of shifting
        const currentItem = this.queue[0];

        if (!currentItem) break;

        // Check if this command requires setup
        if (currentItem.checkSetup && currentItem.type !== CommandType.Setup) {
          const setupResult = checkSetup();
          if (!setupResult.ok) {
            // Setup is required but not complete
            // Look for a Setup command in the queue
            const setupIndex = this.queue.findIndex(
              (item) => item.type === CommandType.Setup
            );

            if (setupIndex > 0) {
              // Found Setup command - move it to the front
              const [setupItem] = this.queue.splice(setupIndex, 1);
              this.queue.unshift(setupItem);
              continue; // Process the Setup command next
            } else if (setupIndex === -1) {
              // No Setup command in queue - pause execution
              console.warn(
                `🧱 Formbricks - Waiting for setup command to be added`
              );
              break;
            }
            // If setupIndex === 0, Setup is already first, so continue below
          }
        }

        // Now safely remove the command we're about to execute
        const itemToExecute = this.queue.shift();
        if (!itemToExecute) continue;

        // Handle GeneralAction - process UpdateQueue first
        if (itemToExecute.type === CommandType.GeneralAction) {
          const updateQueue = UpdateQueue.getInstance();
          if (!updateQueue.isEmpty()) {
            console.log(
              "🧱 Formbricks - Waiting for pending updates to complete before executing command"
            );
            await updateQueue.processUpdates();
          }
        }

        // Execute the command
        const executeCommand = async (): Promise<Result<void, unknown>> => {
          return (await itemToExecute.command.apply(
            null,
            itemToExecute.commandArgs
          )) as Result<void, unknown>;
        };

        const result = await wrapThrowsAsync(executeCommand)();

        if (!result.ok) {
          console.error("🧱 Formbricks - Global error: ", result.error);
        } else if (!result.data.ok) {
          console.error("🧱 Formbricks - Global error: ", result.data.error);
        }
      }
    } finally {
      this.running = false;
      if (this.resolvePromise) {
        this.resolvePromise();
        this.resolvePromise = null;
        this.commandPromise = null;
      }
    }
  }
}
