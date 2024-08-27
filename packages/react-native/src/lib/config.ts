import AsyncStorage from "@react-native-async-storage/async-storage";
import { Result } from "@formbricks/types/error-handlers";
import { TJSAppConfig, TJsAppConfigUpdateInput } from "@formbricks/types/js";
import { RN_ASYNC_STORAGE_KEY } from "../../../js-core/src/shared/constants";

// LocalStorage implementation - default

export class AppConfig {
  private static instance: AppConfig | undefined;
  private config: TJSAppConfig | null = null;

  private constructor() {
    const localConfig = this.loadFromStorage();

    if (localConfig.ok) {
      this.config = localConfig.value;
    }
  }

  static getInstance(): AppConfig {
    if (!AppConfig.instance) {
      AppConfig.instance = new AppConfig();
    }
    return AppConfig.instance;
  }

  public update(newConfig: TJsAppConfigUpdateInput): void {
    if (newConfig) {
      this.config = {
        ...this.config,
        ...newConfig,
        status: newConfig.status ?? "success",
      };

      this.saveToStorage();
    }
  }

  public get(): TJSAppConfig {
    if (!this.config) {
      throw new Error("config is null, maybe the init function was not called?");
    }
    return this.config;
  }

  public async loadFromStorage(): Promise<Result<TJSAppConfig>> {
    try {
      // const savedConfig = await this.storageHandler.getItem(this.storageKey);
      const savedConfig = await AsyncStorage.getItem(RN_ASYNC_STORAGE_KEY);
      if (savedConfig) {
        const parsedConfig = JSON.parse(savedConfig) as TJSAppConfig;

        // check if the config has expired
        if (parsedConfig.expiresAt && new Date(parsedConfig.expiresAt) <= new Date()) {
          return err(new Error("Config in local storage has expired"));
        }

        return ok(parsedConfig);
      }
    } catch (e) {
      return err(new Error("No or invalid config in local storage"));
    }

    return err(new Error("No or invalid config in local storage"));
  }

  private async saveToStorage(): Promise<Result<Promise<void>>> {
    return wrapThrows(async () => {
      await AsyncStorage.setItem(RN_ASYNC_STORAGE_KEY, JSON.stringify(this.config));
    })();
  }

  // reset the config

  public async resetConfig(): Promise<Result<Promise<void>>> {
    this.config = null;

    // return wrapThrows(() => localStorage.removeItem(IN_APP_LOCAL_STORAGE_KEY))();
    return wrapThrows(async () => {
      await AsyncStorage.removeItem(RN_ASYNC_STORAGE_KEY);
    })();
  }
}

export const appConfig = AppConfig.getInstance();
