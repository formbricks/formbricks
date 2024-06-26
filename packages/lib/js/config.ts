import AsyncStorage from "@react-native-async-storage/async-storage";
import { TJSAppConfig, TJsAppConfigUpdateInput } from "@formbricks/types/js";
import { Result, err, ok, wrapThrows } from "./errors";

export const IN_APP_LOCAL_STORAGE_KEY = "formbricks-js-app";

export const LOCAL_STORAGE_KEY = "formbricks-react-native";

export class AppConfig {
  private static instance: AppConfig | undefined;
  private config: TJSAppConfig | null = null;

  private constructor() {
    const localConfig = this.loadFromLocalStorage();

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
        status: newConfig.status || "success",
      };

      this.saveToLocalStorage();
    }
  }

  public get(): TJSAppConfig {
    if (!this.config) {
      throw new Error("config is null, maybe the init function was not called?");
    }
    return this.config;
  }

  public loadFromLocalStorage(): Result<TJSAppConfig, Error> {
    if (typeof window !== "undefined") {
      const savedConfig = localStorage.getItem(IN_APP_LOCAL_STORAGE_KEY);
      if (savedConfig) {
        // TODO: validate config
        // This is a hack to get around the fact that we don't have a proper
        // way to validate the config yet.
        const parsedConfig = JSON.parse(savedConfig) as TJSAppConfig;

        // check if the config has expired
        if (parsedConfig.expiresAt && new Date(parsedConfig.expiresAt) <= new Date()) {
          return err(new Error("Config in local storage has expired"));
        }

        return ok(JSON.parse(savedConfig) as TJSAppConfig);
      }
    }

    return err(new Error("No or invalid config in local storage"));
  }

  private saveToLocalStorage(): Result<void, Error> {
    return wrapThrows(() => localStorage.setItem(IN_APP_LOCAL_STORAGE_KEY, JSON.stringify(this.config)))();
  }

  // reset the config

  public resetConfig(): Result<void, Error> {
    this.config = null;

    return wrapThrows(() => localStorage.removeItem(IN_APP_LOCAL_STORAGE_KEY))();
  }
}

export class RNAppConfig {
  private static instance: RNAppConfig | undefined;
  private config: TJSAppConfig | null = null;

  private constructor() {}

  static getInstance(): RNAppConfig {
    if (!RNAppConfig.instance) {
      RNAppConfig.instance = new RNAppConfig();
    }
    return RNAppConfig.instance;
  }

  public update(newConfig: TJsAppConfigUpdateInput): void {
    if (newConfig) {
      const expiresAt = new Date(new Date().getTime() + 15 * 60000); // 15 minutes in the future

      this.config = {
        ...this.config,
        ...newConfig,
        expiresAt,
      };

      this.saveToLocalStorage();
    }
  }

  public get(): TJSAppConfig {
    if (!this.config) {
      throw new Error("config is null, maybe the init function was not called?");
    }
    return this.config;
  }

  public async loadFromAsyncStorage() {
    return AsyncStorage.getItem(LOCAL_STORAGE_KEY)
      .then((savedConfig) => {
        if (!savedConfig) {
          return err(new Error("No or invalid config in local storage"));
        }
        // TODO: validate config
        // This is a hack to get around the fact that we don't have a proper
        // way to validate the config yet.
        const parsedConfig = JSON.parse(savedConfig) as TJSAppConfig;

        if (parsedConfig.expiresAt && new Date(parsedConfig.expiresAt) <= new Date()) {
          return err(new Error("Config in local storage has expired"));
        }

        this.config = parsedConfig;
      })
      .catch((_) => {
        return err(new Error("No or invalid config in local storage"));
      });
  }

  private saveToLocalStorage(): Result<Promise<void>, Error> {
    return wrapThrows(() =>
      AsyncStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.config)).catch((_) => {
        throw new Error("Unable to save to async storage");
      })
    )();
  }

  // reset the config
  public resetConfig(): Result<Promise<void>, Error> {
    this.config = null;
    return wrapThrows(() =>
      AsyncStorage.removeItem(LOCAL_STORAGE_KEY).catch((_) => {
        throw new Error("Unable to reset config in async storage");
      })
    )();
  }
}
