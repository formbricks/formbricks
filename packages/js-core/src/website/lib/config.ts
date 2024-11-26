import { TJsWebsiteConfig, TJsWebsiteConfigUpdateInput } from "@formbricks/types/js";
import { WEBSITE_SURVEYS_LOCAL_STORAGE_KEY } from "../../shared/constants";
import { Result, err, ok, wrapThrows } from "../../shared/errors";

export class WebsiteConfig {
  private static instance: WebsiteConfig | undefined;
  private config: TJsWebsiteConfig | null = null;

  private constructor() {
    const localConfig = this.loadFromLocalStorage();

    if (localConfig.ok) {
      this.config = localConfig.value;
    }
  }

  static getInstance(): WebsiteConfig {
    if (!WebsiteConfig.instance) {
      WebsiteConfig.instance = new WebsiteConfig();
    }
    return WebsiteConfig.instance;
  }

  public update(newConfig: TJsWebsiteConfigUpdateInput): void {
    if (newConfig) {
      this.config = {
        ...this.config,
        ...newConfig,
        status: newConfig.status || "success",
      };

      this.saveToLocalStorage();
    }
  }

  public get(): TJsWebsiteConfig {
    if (!this.config) {
      throw new Error("config is null, maybe the init function was not called?");
    }
    return this.config;
  }

  public loadFromLocalStorage(): Result<TJsWebsiteConfig, Error> {
    if (typeof window !== "undefined") {
      const savedConfig = localStorage.getItem(WEBSITE_SURVEYS_LOCAL_STORAGE_KEY);
      if (savedConfig) {
        const parsedConfig = JSON.parse(savedConfig) as TJsWebsiteConfig;

        // check if the config has expired
        if (parsedConfig.expiresAt && new Date(parsedConfig.expiresAt) <= new Date()) {
          return err(new Error("Config in local storage has expired"));
        }

        return ok(JSON.parse(savedConfig) as TJsWebsiteConfig);
      }
    }

    return err(new Error("No or invalid config in local storage"));
  }

  private saveToLocalStorage(): Result<void, Error> {
    return wrapThrows(() =>
      localStorage.setItem(WEBSITE_SURVEYS_LOCAL_STORAGE_KEY, JSON.stringify(this.config))
    )();
  }

  // reset the config

  public resetConfig(): Result<void, Error> {
    this.config = null;

    return wrapThrows(() => localStorage.removeItem(WEBSITE_SURVEYS_LOCAL_STORAGE_KEY))();
  }
}
