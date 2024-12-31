/* eslint-disable no-console -- Required for error logging */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { type Result, err, ok, wrapThrowsAsync } from "@formbricks/types/error-handlers";
import type { TJsConfig, TJsConfigUpdateInput } from "@formbricks/types/js";
import { RN_ASYNC_STORAGE_KEY } from "../../../js-core/src/lib/constants";

export class RNConfig {
  private static instance: RNConfig | null = null;

  private config: TJsConfig | null = null;

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

  public update(newConfig: TJsConfigUpdateInput): void {
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

  public get(): TJsConfig {
    if (!this.config) {
      throw new Error("config is null, maybe the init function was not called?");
    }
    return this.config;
  }

  public async loadFromStorage(): Promise<Result<TJsConfig>> {
    try {
      const savedConfig = await AsyncStorage.getItem(RN_ASYNC_STORAGE_KEY);
      if (savedConfig) {
        const parsedConfig = JSON.parse(savedConfig) as TJsConfig;

        // check if the config has expired
        if (
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- need to check if expiresAt is set
          parsedConfig.environmentState.expiresAt &&
          new Date(parsedConfig.environmentState.expiresAt) <= new Date()
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
