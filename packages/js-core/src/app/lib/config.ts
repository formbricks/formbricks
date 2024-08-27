import { TJsConfig, TJsConfigUpdateInput } from "@formbricks/types/js";
import { APP_SURVEYS_LOCAL_STORAGE_KEY } from "../../shared/constants";
import { Result, err, ok, wrapThrows } from "../../shared/errors";

export class AppConfig {
  private static instance: AppConfig | undefined;
  private config: TJsConfig | null = null;

  private constructor() {
    const savedConfig = this.loadFromLocalStorage();

    if (savedConfig.ok) {
      this.config = savedConfig.value;
    }
  }

  static getInstance(): AppConfig {
    if (!AppConfig.instance) {
      AppConfig.instance = new AppConfig();
    }
    return AppConfig.instance;
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

      this.saveToStorage();
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
      const savedConfig = localStorage.getItem(APP_SURVEYS_LOCAL_STORAGE_KEY);
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

  private async saveToStorage(): Promise<Result<Promise<void>, Error>> {
    return wrapThrows(async () => {
      await localStorage.setItem(APP_SURVEYS_LOCAL_STORAGE_KEY, JSON.stringify(this.config));
    })();
  }

  // reset the config

  public async resetConfig(): Promise<Result<Promise<void>, Error>> {
    this.config = null;

    return wrapThrows(async () => {
      localStorage.removeItem(APP_SURVEYS_LOCAL_STORAGE_KEY);
    })();
  }
}
