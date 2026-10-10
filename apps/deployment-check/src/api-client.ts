import { type TConfig } from "./config.ts";
import { CheckFailure } from "./diagnostics.ts";

export interface TApiResponse {
  status: number;
  ok: boolean;
  text: string;
  /** Parsed body, or `undefined` when it was not JSON. */
  json: unknown;
}

interface TRequestOptions {
  body?: unknown;
  /** Management endpoints need the key; public ones must be called without it. */
  authenticated?: boolean;
  /** Which origin to call. Client routes live on the public domain of a split-domain install. */
  origin?: "url" | "publicUrl";
}

const parse = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

export const createApiClient = (config: TConfig) => {
  const request = async (
    method: string,
    path: string,
    options: TRequestOptions = {}
  ): Promise<TApiResponse> => {
    const { body, authenticated = true, origin = "url" } = options;
    const base = origin === "url" ? config.url : config.publicUrl;

    try {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: {
          ...(authenticated ? { "x-api-key": config.apiKey } : {}),
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(config.timeoutMs),
      });
      const text = await response.text();
      return { status: response.status, ok: response.ok, text, json: parse(text) };
    } catch (error) {
      const cause = error instanceof Error ? error.message : String(error);
      throw new CheckFailure(
        "Network",
        `could not reach ${base}${path} (${cause})`,
        "check that the app is running, the URL is correct and this container can route to it"
      );
    }
  };

  /** Raw bytes, for files. `target` is a path on `origin`, or an absolute URL. */
  const getBytes = async (
    target: string,
    options: TRequestOptions = {}
  ): Promise<{ status: number; bytes: Buffer }> => {
    const { authenticated = true, origin = "url" } = options;
    const base = origin === "url" ? config.url : config.publicUrl;
    const url = /^https?:\/\//.test(target) ? target : `${base}${target}`;

    try {
      const response = await fetch(url, {
        headers: authenticated ? { "x-api-key": config.apiKey } : {},
        signal: AbortSignal.timeout(config.timeoutMs),
      });
      return { status: response.status, bytes: Buffer.from(await response.arrayBuffer()) };
    } catch (error) {
      const cause = error instanceof Error ? error.message : String(error);
      throw new CheckFailure(
        "Network",
        `could not reach ${url} (${cause})`,
        "check that the URL is reachable from this container"
      );
    }
  };

  return {
    getBytes,
    get: (path: string, options?: TRequestOptions) => request("GET", path, options),
    post: (path: string, body: unknown, options?: TRequestOptions) =>
      request("POST", path, { ...options, body }),
    delete: (path: string, options?: TRequestOptions) => request("DELETE", path, options),
  };
};

export type TApiClient = ReturnType<typeof createApiClient>;

/** RFC 9457 problem body → one readable line, for failures the API explains itself. */
export const problemDetail = (response: TApiResponse): string => {
  const problem = response.json as
    | { detail?: string; title?: string; invalid_params?: { name: string; reason: string }[] }
    | undefined;
  const base = problem?.detail ?? problem?.title ?? response.text.slice(0, 200);
  const params = (problem?.invalid_params ?? []).map((param) => `${param.name}: ${param.reason}`);
  return params.length > 0 ? `${base} (${params.join("; ")})` : base;
};
