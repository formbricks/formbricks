import AsyncStorage from "@react-native-async-storage/async-storage";

import { Result, err, wrapThrows } from "@formbricks/lib/errors";
import { TJsConfig, TJsConfigUpdateInput } from "@formbricks/types/js";

export const LOCAL_STORAGE_KEY = "formbricks-react-native";

export class Config {
  private static instance: Config | undefined;
  private config: TJsConfig | null = null;

  private constructor() {}

  static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  public update(newConfig: TJsConfigUpdateInput): void {
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

  public get(): TJsConfig {
    if (!this.config) {
      throw new Error("config is null, maybe the init function was not called?");
    }
    return this.config;
  }

  public async loadFromAsyncStorage() {
    console.log("loading config");
    return AsyncStorage.getItem(LOCAL_STORAGE_KEY)
      .then((savedConfig) => {
        if (!savedConfig) {
          console.log("no config found");
          return err(new Error("No or invalid config in local storage"));
        }
        // TODO: validate config
        // This is a hack to get around the fact that we don't have a proper
        // way to validate the config yet.
        const parsedConfig = JSON.parse(savedConfig) as TJsConfig;

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
    return wrapThrows(() => AsyncStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.config)))();
  }

  // reset the config

  public resetConfig(): Result<Promise<void>, Error> {
    this.config = null;
    return wrapThrows(() => AsyncStorage.removeItem(LOCAL_STORAGE_KEY))();
  }
}
