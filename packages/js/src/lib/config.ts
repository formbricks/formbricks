import { JsConfig } from "@formbricks/types/js";

/* class Config {
  private static instance: Config;
  private config: JsConfig;

  private constructor() {
    this.config = this.loadFromLocalStorage();
  }

  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  public get(): JsConfig {
    return this.config;
  }

  public update(newConfig: Partial<JsConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
    };
    this.saveToLocalStorage();
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

export default Config.getInstance(); */

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
