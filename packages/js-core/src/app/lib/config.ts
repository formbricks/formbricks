import { TJSAppConfig, TJsAppConfigUpdateInput } from "@formbricks/types/js";
import { APP_SURVEYS_LOCAL_STORAGE_KEY } from "../../shared/constants";
import { Result, err, ok, wrapThrows } from "../../shared/errors";

export interface StorageHandler {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

// LocalStorage implementation - default
class LocalStorage implements StorageHandler {
  async getItem(key: string): Promise<string | null> {
    return localStorage.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    localStorage.removeItem(key);
  }
}

export class AppConfig {
  private static instance: AppConfig | undefined;
  private config: TJSAppConfig | null = null;
  private storageHandler: StorageHandler;
  private storageKey: string;

  private constructor(
    storageHandler: StorageHandler = new LocalStorage(),
    storageKey: string = APP_SURVEYS_LOCAL_STORAGE_KEY
  ) {
    this.storageHandler = storageHandler;
    this.storageKey = storageKey;

    this.loadFromStorage().then((res) => {
      if (res.ok) {
        this.config = res.value;
      }
    });
  }

  static getInstance(storageHandler?: StorageHandler, storageKey?: string): AppConfig {
    if (!AppConfig.instance) {
      AppConfig.instance = new AppConfig(storageHandler, storageKey);
    }
    return AppConfig.instance;
  }

  public update(newConfig: TJsAppConfigUpdateInput): void {
    if (newConfig) {
      this.config = {
        ...this.config,
        ...newConfig,
        status: newConfig.status || "success",
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

  public async loadFromStorage(): Promise<Result<TJSAppConfig, Error>> {
    try {
      const savedConfig = await this.storageHandler.getItem(this.storageKey);
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

  private async saveToStorage(): Promise<Result<Promise<void>, Error>> {
    return wrapThrows(async () => {
      await this.storageHandler.setItem(this.storageKey, JSON.stringify(this.config));
    })();
  }

  // reset the config

  public async resetConfig(): Promise<Result<Promise<void>, Error>> {
    this.config = null;

    // return wrapThrows(() => localStorage.removeItem(IN_APP_LOCAL_STORAGE_KEY))();
    return wrapThrows(async () => {
      await this.storageHandler.removeItem(this.storageKey);
    })();
  }
}
