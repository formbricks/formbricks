/* eslint-disable no-console -- Required for error logging */
import { AsyncStorage } from "@/lib/common/storage";
import { wrapThrowsAsync } from "@/lib/common/utils";
import type { TConfig, TConfigUpdateInput } from "@/types/config";
import { type Result, err, ok } from "@/types/error";

export const RN_ASYNC_STORAGE_KEY = "formbricks-react-native";

export class RNConfig {
  private static instance: RNConfig | null = null;

  private config: TConfig | null = null;

  private constructor() {
    this.loadFromStorage()
      .then((localConfig) => {
        if (localConfig.ok) {
          this.config = localConfig.data;
        }
      })
      .catch((e: unknown) => {
        console.error("Error loading config from storage", e);
      });
  }

  static getInstance(): RNConfig {
    if (!RNConfig.instance) {
      RNConfig.instance = new RNConfig();
    }

    return RNConfig.instance;
  }

  public update(newConfig: TConfigUpdateInput): void {
    this.config = {
      ...this.config,
      ...newConfig,
      status: {
        value: newConfig.status?.value ?? "success",
        expiresAt: newConfig.status?.expiresAt ?? null,
      },
    };

    void this.saveToStorage();
  }

  public get(): TConfig {
    if (!this.config) {
      throw new Error("config is null, maybe the init function was not called?");
    }
    return this.config;
  }

  public async loadFromStorage(): Promise<Result<TConfig>> {
    try {
      const savedConfig = await AsyncStorage.getItem(RN_ASYNC_STORAGE_KEY);
      if (savedConfig) {
        const parsedConfig = JSON.parse(savedConfig) as TConfig;

        // check if the config has expired
        if (
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- need to check if expiresAt is set
          parsedConfig.environment.expiresAt &&
          new Date(parsedConfig.environment.expiresAt) <= new Date()
        ) {
          return err(new Error("Config in local storage has expired"));
        }

        return ok(parsedConfig);
      }
    } catch {
      return err(new Error("No or invalid config in local storage"));
    }

    return err(new Error("No or invalid config in local storage"));
  }

  private async saveToStorage(): Promise<Result<void>> {
    return wrapThrowsAsync(async () => {
      await AsyncStorage.setItem(RN_ASYNC_STORAGE_KEY, JSON.stringify(this.config));
    })();
  }

  // reset the config
  public async resetConfig(): Promise<Result<void>> {
    this.config = null;

    return wrapThrowsAsync(async () => {
      await AsyncStorage.removeItem(RN_ASYNC_STORAGE_KEY);
    })();
  }
}
