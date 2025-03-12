/* eslint-disable @typescript-eslint/no-empty-function -- required for singleton pattern */
import { Config } from "@/lib/common/config";
import { Logger } from "@/lib/common/logger";
import { sendUpdates } from "@/lib/user/update";
import type { TAttributes, TUpdates } from "@/types/config";

export class UpdateQueue {
  private static instance: UpdateQueue | null = null;
  private updates: TUpdates | null = null;
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
    const config = Config.getInstance();
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

  public getUpdates(): TUpdates | null {
    return this.updates;
  }

  public clearUpdates(): void {
    this.updates = null;
  }

  public isEmpty(): boolean {
    return !this.updates;
  }

  public async processUpdates(): Promise<void> {
    const logger = Logger.getInstance();
    if (!this.updates) {
      return;
    }

    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }

    return new Promise((resolve, reject) => {
      const handler = async (): Promise<void> => {
        try {
          let currentUpdates = { ...this.updates };
          const config = Config.getInstance();

          if (Object.keys(currentUpdates).length > 0) {
            // Get userId from either updates or config
            const effectiveUserId = currentUpdates.userId ?? config.get().user.data.userId;
            const isLanguageInUpdates = currentUpdates.attributes?.language;

            if (!effectiveUserId && isLanguageInUpdates) {
              // no user id set but the updates contain a language
              // we need to set this language in the local config:
              config.update({
                ...config.get(),
                user: {
                  ...config.get().user,
                  data: {
                    ...config.get().user.data,
                    language: currentUpdates.attributes?.language,
                  },
                },
              });

              logger.debug("Updated language successfully");

              const { language: _, ...remainingAttributes } = currentUpdates.attributes ?? {};

              // remove language from attributes
              currentUpdates = {
                ...currentUpdates,
                attributes: remainingAttributes,
              };
            }

            if (Object.keys(currentUpdates.attributes ?? {}).length > 0 && !effectiveUserId) {
              const errorMessage =
                "Formbricks can't set attributes without a userId! Please set a userId first with the setUserId function";
              logger.error(errorMessage);
              this.clearUpdates();
            }

            // Only send updates if we have a userId (either from updates or local storage)
            if (effectiveUserId) {
              const result = await sendUpdates({
                updates: {
                  userId: effectiveUserId,
                  attributes: currentUpdates.attributes ?? {},
                },
              });

              if (result.ok) {
                logger.debug("Updates sent successfully");
              } else {
                logger.error("Failed to send updates");
              }
            }
          }

          this.clearUpdates();
          resolve();
        } catch (error: unknown) {
          logger.error(
            `Failed to process updates: ${error instanceof Error ? error.message : "Unknown error"}`
          );
          reject(error as Error);
        }
      };

      this.debounceTimeout = setTimeout(() => void handler(), this.DEBOUNCE_DELAY);
    });
  }
}
