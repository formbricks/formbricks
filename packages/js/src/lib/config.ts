import { JsConfig } from "@formbricks/types/js";
import { Result, wrapThrows } from "./errors";
import { Logger } from "./logger";

export class Config {
  private static instance: Config | undefined;
  private config: JsConfig = this.loadFromLocalStorage();

  // default error handler
  private errHandler = (error: any) => {
    Logger.getInstance().error(error);
  };

  private constructor(errHandler?: (error: any) => void) {
    if (errHandler) {
      this.errHandler = errHandler;
    }
  }

  static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  public update(newConfig: Partial<JsConfig>): void {
    if (newConfig) {
      this.config = {
        ...this.config,
        ...newConfig,
      };
      this.saveToLocalStorage();
    }
  }

  public get(): JsConfig {
    return this.config;
  }

  public get errorHandler(): (error: any) => void {
    return this.errHandler;
  }

  private loadFromLocalStorage(): JsConfig {
    if (typeof window !== "undefined") {
      const savedConfig = localStorage.getItem("config");
      if (savedConfig) {
        return JSON.parse(savedConfig);
      }
    }
    return {
      apiHost: null,
      environmentId: null,
    };
  }

  private saveToLocalStorage(): Result<void, Error> {
    return wrapThrows(() => localStorage.setItem("config", JSON.stringify(this.config)))();
  }
}
