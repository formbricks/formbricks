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
            console.warn(
              `🧱 Formbricks - SDK not setup. Pausing queue until setup completes.`
            );
            // Strict FIFO: If the head of the queue is blocked, we PAUSE.
            // We do NOT shift it. We do NOT search for other commands.
            // We return to exit the run loop.
            // The queue will resume when run() is called again (e.g. by setup completion).
            return;
          }
        }

        // Runnaable: safely remove the command we're about to execute
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
        } else if (result.data && !(result.data as any).ok) {
          console.error("🧱 Formbricks - Global error: ", (result.data as any).error);
        }
      }
    } finally {
      this.running = false;
      // Only resolve the wait promise if the queue is actually empty.
      // If we paused due to blocking, we keeping the promise implementation implicitly handles "not resolved yet"
      // BUT, existing wait() might expect to be resolved when "idle".
      // Strict interpretation: wait() waits for DRAIN. If not drained (paused), it should not resolve?
      // Or does wait() mean "wait until current processing batch finishes"?
      // Usually "wait" implies "wait until empty".
      if (this.queue.length === 0 && this.resolvePromise) {
        this.resolvePromise();
        this.resolvePromise = null;
        this.commandPromise = null;
      }
    }
  }
}
