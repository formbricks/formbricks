import { JS_LOCAL_STORAGE_KEY } from "@/lib/common/constants";
import { wrapThrows } from "@/lib/common/utils";
import type { TConfig, TConfigUpdateInput } from "@/types/config";
import { type Result, err, ok } from "@/types/error";

export class Config {
  private static instance: Config | null = null;
  private config: TConfig | null = null;

  private constructor() {
    const savedConfig = this.loadFromLocalStorage();

    if (savedConfig.ok) {
      this.config = savedConfig.data;
    }
  }

  static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }

    return Config.instance;
  }

  public update(newConfig: TConfigUpdateInput): void {
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

  public get(): TConfig {
    if (!this.config) {
      throw new Error("config is null, maybe the init function was not called?");
    }
    return this.config;
  }

  public loadFromLocalStorage(): Result<TConfig> {
    if (typeof window !== "undefined") {
      const savedConfig = localStorage.getItem(JS_LOCAL_STORAGE_KEY);
      if (savedConfig) {
        // TODO: validate config
        // This is a hack to get around the fact that we don't have a proper
        // way to validate the config yet.
        const parsedConfig = JSON.parse(savedConfig) as TConfig;
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
