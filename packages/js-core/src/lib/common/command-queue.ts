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

        if (type === CommandType.Setup) {
          // Remove any existing setup command and add this one to the front.
          this.queue = this.queue.filter((item) => item.type !== CommandType.Setup);
          this.queue.unshift(newItem);
        } else if (type === CommandType.UserAction) {
          // newItem (UserAction) is currently at the end due to the initial push.
          // We pop it and then re-insert it at the correct position.
          const itemPopped = this.queue.pop();

          // We expect itemPopped to be newItem. If not, this is an unexpected state.
          // For robustness in this step, we will proceed to place the original newItem.
          if (itemPopped !== newItem) {
            console.warn(
              "🧱 Formbricks - CommandQueue: Popped item was not the newItem during UserAction handling. This is unexpected. Proceeding to place the original newItem."
            );
            // If itemPopped was something else, it means newItem might still be in the queue or gone.
            // This state is problematic. For now, we focus on placing newItem as intended.
          }

          let firstNonSetupIndex = 0;
          while (
            firstNonSetupIndex < this.queue.length &&
            this.queue[firstNonSetupIndex].type === CommandType.Setup
          ) {
            firstNonSetupIndex++;
          }

          let initialActionIsGA = false;
          if (
            firstNonSetupIndex < this.queue.length &&
            this.queue[firstNonSetupIndex].type === CommandType.GeneralAction
          ) {
            initialActionIsGA = true;
          }

          if (initialActionIsGA) {
            let insertionPoint = firstNonSetupIndex;
            while (
              insertionPoint < this.queue.length &&
              this.queue[insertionPoint].type === CommandType.GeneralAction
            ) {
              insertionPoint++;
            }
            this.queue.splice(insertionPoint, 0, newItem); // Use newItem directly
          } else {
            const firstGeneralActionIndex = this.queue.findIndex(
              (item, index) => index >= firstNonSetupIndex && item.type === CommandType.GeneralAction
            );

            if (firstGeneralActionIndex === -1) {
              this.queue.push(newItem); // Use newItem directly
            } else {
              this.queue.splice(firstGeneralActionIndex, 0, newItem); // Use newItem directly
            }
          }
        } else {
          // type === CommandType.GeneralAction
          // GENERAL_ACTION: newItem was pushed at the start of the 'add' method.
          // It's currently at the end, which is its correct position.
          // No further action needed here (this fixes the previous duplicate push).
        }

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
      const currentItem = this.queue.shift();

      if (!currentItem) continue;

      if (currentItem.checkSetup) {
        const setupResult = checkSetup();
        if (!setupResult.ok) {
          console.warn(`🧱 Formbricks - Setup not complete.`);
          continue;
        }
      }

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
