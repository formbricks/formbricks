import { TJsConfig } from "@formbricks/types/v1/js";
import { Result, wrapThrows } from "./errors";

const LOCAL_STORAGE_KEY = "formbricks-js";

export class Config {
  private static instance: Config | undefined;
  private config: TJsConfig = this.loadFromLocalStorage();
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

  public update(newConfig: Partial<TJsConfig>): void {
    if (newConfig) {
      this.config = {
        ...this.config,
        ...newConfig,
      };
      this.saveToLocalStorage();
    }
  }

  public get(): TJsConfig {
    return this.config;
  }

  private loadFromLocalStorage(): TJsConfig {
    if (typeof window !== "undefined") {
      const savedConfig = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedConfig) {
        return JSON.parse(savedConfig);
      }
    }
    return {
      apiHost: null,
      environmentId: null,
    } as unknown as TJsConfig;
  }

  private saveToLocalStorage(): Result<void, Error> {
    return wrapThrows(() => localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.config)))();
  }
}
