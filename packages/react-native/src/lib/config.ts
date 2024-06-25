import AsyncStorage from "@react-native-async-storage/async-storage";
import { Result, err, wrapThrows } from "@formbricks/lib/errors";
import { TJSAppConfig, TJsAppConfigUpdateInput, ZJSAppConfig } from "@formbricks/types/js";

export const LOCAL_STORAGE_KEY = "formbricks-react-native";

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
        const parsedConfig = ZJSAppConfig.parse(savedConfig);

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
