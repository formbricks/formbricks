import { TJsConfig } from "@formbricks/types/v1/js";
import { Result, err, ok, wrapThrows } from "./errors";

export const LOCAL_STORAGE_KEY = "formbricks-js";

export class Config {
  private static instance: Config | undefined;
  private config: TJsConfig | null = null;
  private _isSyncAllowed: boolean = true;

  public allowSync() {
    this._isSyncAllowed = true;
  }

  public disallowSync() {
    this._isSyncAllowed = false;
  }

  public get isSyncAllowed() {
    return this._isSyncAllowed;
  }

  static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  public update(newConfig: TJsConfig): void {
    if (newConfig) {
      this.config = {
        ...this.config,
        ...newConfig,
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

  public loadFromLocalStorage(): Result<TJsConfig, Error> {
    if (typeof window !== "undefined") {
      const savedConfig = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedConfig) {
        // TODO: validate config
        // This is a hack to get around the fact that we don't have a proper
        // way to validate the config yet.
        return ok(JSON.parse(savedConfig) as TJsConfig);
      }
    }

    return err(new Error("No or invalid config in local storage"));
  }

  private saveToLocalStorage(): Result<void, Error> {
    return wrapThrows(() => localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.config)))();
  }

  // reset the config

  public resetConfig(): Result<void, Error> {
    this.config = null;

    return wrapThrows(() => localStorage.removeItem(LOCAL_STORAGE_KEY))();
  }
}
