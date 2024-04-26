import { TJSAppConfig, TJsAppConfigUpdateInput } from "@formbricks/types/js";

import { Result, err, ok, wrapThrows } from "../../shared/errors";

export const IN_APP_LOCAL_STORAGE_KEY = "formbricks-js-app";

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
