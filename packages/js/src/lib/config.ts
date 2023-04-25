import { JsConfig } from "@formbricks/types/js";
import { Result, wrapThrows } from "./errors";

export class Config {
  private static instance: Config | undefined;
  private config: JsConfig = this.loadFromLocalStorage();

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

  private loadFromLocalStorage(): JsConfig {
    if (typeof window !== "undefined") {
      const savedConfig = localStorage.getItem("formbricksConfig");
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
    return wrapThrows(() => localStorage.setItem("formbricksConfig", JSON.stringify(this.config)))();
  }
}
