import { JsConfig } from "@formbricks/types/js";

export class Config {
  private static instance: Config | undefined;
  private config: JsConfig = this.loadFromLocalStorage();

  private constructor() {}

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

  private saveToLocalStorage(): void {
    localStorage.setItem("config", JSON.stringify(this.config));
  }
}
