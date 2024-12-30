import { type TJsConfig, type TJsConfigUpdateInput } from "@formbricks/types/js";
import { JS_LOCAL_STORAGE_KEY } from "./constants";
import { type Result, err, ok, wrapThrows } from "./errors";

export class Config {
  private static instance: Config | undefined;
  private config: TJsConfig | null = null;

  private constructor() {
    const savedConfig = this.loadFromLocalStorage();

    if (savedConfig.ok) {
      this.config = savedConfig.value;
    }
  }

  static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  public update(newConfig: TJsConfigUpdateInput): void {
    this.config = {
      ...this.config,
      ...newConfig,
      status: {
        value: newConfig.status?.value ?? "success",
        expiresAt: newConfig.status?.expiresAt ?? null,
      },
    };

    void this.saveToStorage();
  }

  public get(): TJsConfig {
    if (!this.config) {
      throw new Error("config is null, maybe the init function was not called?");
    }
    return this.config;
  }

  public loadFromLocalStorage(): Result<TJsConfig> {
    if (typeof window !== "undefined") {
      const savedConfig = localStorage.getItem(JS_LOCAL_STORAGE_KEY);
      if (savedConfig) {
        // TODO: validate config
        // This is a hack to get around the fact that we don't have a proper
        // way to validate the config yet.
        const parsedConfig = JSON.parse(savedConfig) as TJsConfig;

        // check if the config has expired
        if (
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- In case of an error, we don't have environmentState
          new Date(parsedConfig.environmentState?.expiresAt) <= new Date()
        ) {
          return err(new Error("Config in local storage has expired"));
        }

        return ok(parsedConfig);
      }
    }

    return err(new Error("No or invalid config in local storage"));
  }

  private saveToStorage(): Result<void> {
    return wrapThrows(() => {
      localStorage.setItem(JS_LOCAL_STORAGE_KEY, JSON.stringify(this.config));
    })();
  }

  // reset the config

  public resetConfig(): Result<void> {
    this.config = null;

    return wrapThrows(() => {
      localStorage.removeItem(JS_LOCAL_STORAGE_KEY);
    })();
  }
}
