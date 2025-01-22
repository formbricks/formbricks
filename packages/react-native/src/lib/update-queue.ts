/* eslint-disable no-console -- required for logging errors */
/* eslint-disable @typescript-eslint/no-empty-function -- required for singleton pattern */
import type { TAttributes, TJsUpdates } from "../types/config";
import { RNConfig } from "./config";
import { Logger } from "./logger";
import { sendUpdates } from "./updates";

const logger = Logger.getInstance();

export class UpdateQueue {
  private static instance: UpdateQueue | null = null;
  private updates: TJsUpdates | null = null;
  private debounceTimeout: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_DELAY = 500;

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
    const config = RNConfig.getInstance();
    // Get userId from updates first, then fallback to config
    const userId = this.updates?.userId ?? config.get().user.data.userId ?? "";

    if (!this.updates) {
      this.updates = {
        userId,
        attributes,
      };
    } else {
      this.updates = {
        ...this.updates,
        userId,
        attributes: { ...this.updates.attributes, ...attributes },
      };
    }
  }

  public updateLanguage(language: string): void {
    if (!this.updates) {
      this.updates = {
        userId: "",
        attributes: {},
        language,
      };
    } else {
      this.updates = {
        ...this.updates,
        language,
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

    return new Promise((resolve, reject) => {
      const handler = async (): Promise<void> => {
        try {
          const currentUpdates = { ...this.updates };
          const config = RNConfig.getInstance();

          if (Object.keys(currentUpdates).length > 0) {
            // Check if we have any attributes to update
            const hasAttributes =
              currentUpdates.attributes && Object.keys(currentUpdates.attributes).length > 0;

            // Get userId from either updates or config
            const effectiveUserId = currentUpdates.userId ?? config.get().user.data.userId;

            if (hasAttributes && !effectiveUserId) {
              const errorMessage =
                "Formbricks can't set attributes without a userId! Please set a userId first with the setUserId function";
              logger.error(errorMessage);
              this.clearUpdates();
              throw new Error(errorMessage);
            }

            // Only send updates if we have a userId (either from updates or local storage)
            if (effectiveUserId) {
              await sendUpdates({
                updates: {
                  userId: effectiveUserId,
                  attributes: currentUpdates.attributes ?? {},
                  language: currentUpdates.language,
                },
              });
            }
          }

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
