import { TJsAppConfigUpdateInput, TJsConfig } from "@formbricks/types/js";
import { Result, err, ok, wrapThrows } from "../../shared/errors";

export const IN_APP_LOCAL_STORAGE_KEY = "formbricks-js-app";

type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

export class AppConfig {
  private static instance: AppConfig | undefined;
  private config: TJsConfig | null = null;

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

  public update(newConfig: DeepPartial<TJsAppConfigUpdateInput>): void {
    if (newConfig) {
      this.config = this.deepMerge(this.config, newConfig) as TJsConfig;
      this.saveToLocalStorage();
    }
  }

  private deepMerge(target: any, source: any): any {
    if (typeof source !== "object" || source === null) {
      return source;
    }

    if (typeof target !== "object" || target === null) {
      return this.deepMerge({}, source);
    }

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] !== undefined) {
          if (source[key] instanceof Date) {
            // Directly assign the date if the value is a Date instance
            target[key] = new Date(source[key].getTime());
          } else if (typeof source[key] === "object" && !Array.isArray(source[key])) {
            target[key] = this.deepMerge(target[key] || {}, source[key]);
          } else {
            target[key] = source[key];
          }
        }
      }
    }

    return target;
  }

  public get(): TJsConfig {
    if (!this.config) {
      throw new Error("config is null, maybe the init function was not called?");
    }
    return this.config;
  }

  public loadFromLocalStorage(): Result<TJsConfig, Error> {
    if (typeof window !== "undefined") {
      const savedConfig = localStorage.getItem(IN_APP_LOCAL_STORAGE_KEY);
      if (savedConfig) {
        // TODO: validate config
        // This is a hack to get around the fact that we don't have a proper
        // way to validate the config yet.
        const parsedConfig = JSON.parse(savedConfig) as TJsConfig;

        // check if the config has expired
        if (
          parsedConfig.environmentState?.expiresAt &&
          new Date(parsedConfig.environmentState.expiresAt) <= new Date()
        ) {
          return err(new Error("Config in local storage has expired"));
        }

        return ok(parsedConfig);
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
