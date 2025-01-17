/* eslint-disable no-console -- required for logging errors */
/* eslint-disable @typescript-eslint/require-await -- required for async functions */
/* eslint-disable @typescript-eslint/no-empty-function -- required for singleton pattern */
import type { TAttributes, TJsUpdates } from "../types/config";

export class UpdateQueue {
  private static instance: UpdateQueue | null = null;
  private updates: TJsUpdates | null = null;
  private debounceTimeout: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_DELAY = 5000;

  private constructor() {}

  public static getInstance(): UpdateQueue {
    if (!UpdateQueue.instance) {
      UpdateQueue.instance = new UpdateQueue();
    }

    return UpdateQueue.instance;
  }

  public updateUserId(userId: string): void {
    if (!this.updates) {
      this.updates = {
        userId,
        attributes: {},
      };
    } else {
      this.updates = {
        ...this.updates,
        userId,
      };
    }
  }

  public updateAttributes(attributes: TAttributes): void {
    if (!this.updates) {
      this.updates = {
        userId: "",
        attributes,
      };
    } else {
      this.updates = {
        ...this.updates,
        attributes: { ...this.updates.attributes, ...attributes },
      };
    }
  }

  public getUpdates(): TJsUpdates | null {
    return this.updates;
  }

  public clearUpdates(): void {
    this.updates = null;
  }

  public isEmpty(): boolean {
    return !this.updates;
  }

  public async processUpdates(): Promise<void> {
    if (!this.updates) {
      return;
    }

    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }

    // Return a promise that resolves when the debounced operation completes
    return new Promise((resolve, reject) => {
      const handler = async (): Promise<void> => {
        try {
          const currentUpdates = { ...this.updates };
          console.log("updates to send now: ", currentUpdates);

          // TODO: Add your API call here to send the updates to the server
          // await api.sendUpdates(currentUpdates);

          this.clearUpdates();
          resolve();
        } catch (error) {
          console.error("Failed to process updates:", error);
          reject(error as Error);
        }
      };

      this.debounceTimeout = setTimeout(() => void handler(), this.DEBOUNCE_DELAY);
    });
  }
}
