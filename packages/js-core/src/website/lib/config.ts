import { TJsConfig, TJsConfigUpdateInput } from "@formbricks/types/js";
import { WEBSITE_SURVEYS_LOCAL_STORAGE_KEY } from "../../shared/constants";
import { Result, err, ok, wrapThrows } from "../../shared/errors";

export class WebsiteConfig {
  private static instance: WebsiteConfig | undefined;
  private config: TJsConfig | null = null;

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

  public update(newConfig: TJsConfigUpdateInput): void {
    if (newConfig) {
      this.config = {
        ...this.config,
        ...newConfig,
        status: {
          value: newConfig.status?.value || "success",
          expiresAt: newConfig.status?.expiresAt || null,
        },
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
      const savedConfig = localStorage.getItem(WEBSITE_SURVEYS_LOCAL_STORAGE_KEY);
      if (savedConfig) {
        // TODO: validate config
        // This is a hack to get around the fact that we don't have a proper
        // way to validate the config yet.
        const parsedConfig = JSON.parse(savedConfig) as TJsConfig;

        // check if the config has expired

        // TODO: Figure out the expiration logic
        if (
          parsedConfig.environmentState.expiresAt &&
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
