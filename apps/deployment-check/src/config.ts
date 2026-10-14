import { z } from "zod";

const ZBaseUrl = z
  .url({ protocol: /^https?$/, message: "must be an http(s) URL such as https://formbricks.example.com" })
  .transform((value) => value.replace(/\/+$/, ""));

const ZEnv = z.object({
  FORMBRICKS_URL: ZBaseUrl,
  FORMBRICKS_PUBLIC_URL: ZBaseUrl.optional(),
  FORMBRICKS_API_KEY: z.string().trim().min(1, "must not be empty"),
  FORMBRICKS_WORKSPACE_ID: z.string().trim().min(1).optional(),
  CHECK_STORAGE: z.enum(["auto", "true", "false"]).default("auto"),
  CHECK_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300_000).default(30_000),
});

export type TStorageMode = "auto" | "true" | "false";

export interface TConfig {
  /** `WEBAPP_URL` of the instance: management API and admin UI. */
  url: string;
  /** `PUBLIC_URL`: survey pages and client APIs. Equals `url` unless the instance splits domains. */
  publicUrl: string;
  splitDomain: boolean;
  apiKey: string;
  workspaceId: string | undefined;
  storage: TStorageMode;
  timeoutMs: number;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/** `docker run -e VAR=` passes an empty string, which should read as "not set". */
const dropEmpty = (env: Record<string, string | undefined>): Record<string, string> =>
  Object.fromEntries(Object.entries(env).filter((entry): entry is [string, string] => Boolean(entry[1])));

export const loadConfig = (env: Record<string, string | undefined>): TConfig => {
  const parsed = ZEnv.safeParse(dropEmpty(env));

  if (!parsed.success) {
    // Names the variable and never echoes its value: FORMBRICKS_API_KEY must not reach a log.
    const lines = parsed.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`);
    throw new ConfigError(`Invalid deployment-check configuration:\n${lines.join("\n")}`);
  }

  const data = parsed.data;
  const publicUrl = data.FORMBRICKS_PUBLIC_URL ?? data.FORMBRICKS_URL;

  return {
    url: data.FORMBRICKS_URL,
    publicUrl,
    splitDomain: publicUrl !== data.FORMBRICKS_URL,
    apiKey: data.FORMBRICKS_API_KEY,
    workspaceId: data.FORMBRICKS_WORKSPACE_ID,
    storage: data.CHECK_STORAGE,
    timeoutMs: data.CHECK_TIMEOUT_MS,
  };
};

/** Strips the API key from any text on its way to a console, report or trace. */
export const redact = (text: string, config: Pick<TConfig, "apiKey">): string =>
  config.apiKey ? text.split(config.apiKey).join("[redacted]") : text;
