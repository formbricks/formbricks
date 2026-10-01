import { Buffer } from "node:buffer";
import { AIOAuthTokenError } from "./errors";

export type OAuthAuthStyle = "basic" | "post";

export interface OAuthClientCredentialsConfig {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
  authStyle: OAuthAuthStyle;
  extraParams?: Record<string, string>;
}

export interface OAuthTokenSourceDeps {
  /** Defaults to `globalThis.fetch`, looked up on every call so a later swap (tests, instrumentation) is honoured. */
  fetch?: typeof fetch;
  now?: () => number;
}

export interface OAuthTokenSource {
  getToken: () => Promise<string>;
  /** Compare-and-delete: evicts the cached token only if it is exactly `usedToken`. */
  invalidate: (usedToken: string) => void;
}

export const OAUTH_TOKEN_REQUEST_TIMEOUT_MS = 10_000;
/** Refresh this long before the token's reported expiry, so a request never leaves with a dying token. */
export const OAUTH_TOKEN_EXPIRY_SKEW_MS = 60_000;
/** Used when the token response carries no usable `expires_in`. */
export const OAUTH_TOKEN_DEFAULT_TTL_MS = 5 * 60_000;
/** How long a definitive rejection (4xx, malformed response) is replayed without calling the endpoint. */
export const OAUTH_TOKEN_NEGATIVE_CACHE_MS = 20_000;

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

interface NegativeCacheEntry {
  error: AIOAuthTokenError;
  until: number;
  /** A throttle back-off still lets callers use an unexpired cached token; a definitive rejection does not. */
  fallbackToCached: boolean;
}

const getTokenUrlHost = (tokenUrl: string): string => {
  try {
    return new URL(tokenUrl).host;
  } catch {
    return "";
  }
};

// RFC 6749 §2.3.1: client_id and client_secret are form-urlencoded before being joined for Basic auth.
const encodeBasicCredentials = (clientId: string, clientSecret: string): string =>
  Buffer.from(`${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`).toString("base64");

const buildTokenRequestInit = (config: OAuthClientCredentialsConfig): RequestInit => {
  const body = new URLSearchParams({ grant_type: "client_credentials" });

  if (config.scope) {
    body.set("scope", config.scope);
  }

  for (const [key, value] of Object.entries(config.extraParams ?? {})) {
    body.set(key, value);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };

  if (config.authStyle === "post") {
    body.set("client_id", config.clientId);
    body.set("client_secret", config.clientSecret);
  } else {
    headers.Authorization = `Basic ${encodeBasicCredentials(config.clientId, config.clientSecret)}`;
  }

  return {
    method: "POST",
    headers,
    body: body.toString(),
    // The credentials travel in this request, in the header or the body. A 307/308 would replay the
    // body — and with it a `post`-style client_secret — to wherever the endpoint points, so a redirect
    // is returned as-is and fails below as a non-2xx instead of being followed.
    redirect: "manual",
    // The token request owns its timeout. It never inherits a caller's signal: one user pressing
    // Stop must not abort a refresh that every concurrent request is waiting on.
    signal: AbortSignal.timeout(OAUTH_TOKEN_REQUEST_TIMEOUT_MS),
  };
};

const parseTokenResponse = async (
  response: Response
): Promise<{ accessToken: string; expiresInSeconds?: number } | undefined> => {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    return undefined;
  }

  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }

  const {
    access_token: accessToken,
    token_type: tokenType,
    expires_in: expiresIn,
  } = payload as Record<string, unknown>;

  if (typeof accessToken !== "string" || accessToken.length === 0) {
    return undefined;
  }

  if (tokenType !== undefined && (typeof tokenType !== "string" || tokenType.toLowerCase() !== "bearer")) {
    return undefined;
  }

  const expiresInSeconds = typeof expiresIn === "string" ? Number(expiresIn) : expiresIn;

  return {
    accessToken,
    expiresInSeconds:
      typeof expiresInSeconds === "number" && Number.isFinite(expiresInSeconds)
        ? expiresInSeconds
        : undefined,
  };
};

export const createOAuthTokenSource = (
  config: OAuthClientCredentialsConfig,
  deps: OAuthTokenSourceDeps = {}
): OAuthTokenSource => {
  const now = deps.now ?? Date.now;
  const tokenUrlHost = getTokenUrlHost(config.tokenUrl);

  let cached: CachedToken | undefined;
  let negativeCache: NegativeCacheEntry | undefined;
  let inflight: Promise<string> | undefined;

  /**
   * How a failed token request is handled:
   *
   * - `definitive` (4xx, malformed response): the endpoint has answered, so the answer is
   *   negative-cached and thrown — a new call will not change it.
   * - `transient` (timeout, network, 5xx): the endpoint is down; thrown without negative caching so
   *   the next request tries again.
   * - `throttled` (429): the endpoint is asking for a pause; negative-cached so the pause is honoured.
   *
   * A transient or throttled failure inside the expiry skew, while the cached token has not actually
   * expired, falls back to that token: it is still good to use. A definitive one never does.
   */
  const fail = (
    error: AIOAuthTokenError,
    { kind }: { kind: "definitive" | "transient" | "throttled" }
  ): string => {
    const currentTime = now();

    if (kind !== "transient") {
      negativeCache = {
        error,
        until: currentTime + OAUTH_TOKEN_NEGATIVE_CACHE_MS,
        fallbackToCached: kind === "throttled",
      };
    }

    if (kind !== "definitive" && cached && currentTime < cached.expiresAt) {
      return cached.accessToken;
    }

    throw error;
  };

  const classifyStatus = (status: number): "definitive" | "transient" | "throttled" => {
    if (status === 429) return "throttled";
    if (status >= 500) return "transient";
    return "definitive";
  };

  const requestToken = async (): Promise<string> => {
    const fetchImpl = deps.fetch ?? globalThis.fetch;
    let response: Response;

    try {
      response = await fetchImpl(config.tokenUrl, buildTokenRequestInit(config));
    } catch (error) {
      // Transport failures are not negative-cached: the next request should try again.
      const code =
        error instanceof Error && error.name === "TimeoutError"
          ? "token_endpoint_timeout"
          : "token_endpoint_unreachable";
      return fail(new AIOAuthTokenError(code, { tokenUrlHost }), { kind: "transient" });
    }

    if (!response.ok) {
      // A 4xx is the endpoint's definitive answer (bad credentials, unknown scope), a 429 is a
      // throttle, a 5xx is transient. A 3xx lands here too: redirects are not followed, see above.
      return fail(
        new AIOAuthTokenError("token_request_failed", { statusCode: response.status, tokenUrlHost }),
        { kind: classifyStatus(response.status) }
      );
    }

    const token = await parseTokenResponse(response);

    if (!token) {
      return fail(new AIOAuthTokenError("token_response_invalid", { tokenUrlHost }), { kind: "definitive" });
    }

    const ttl =
      token.expiresInSeconds !== undefined && token.expiresInSeconds > 0
        ? token.expiresInSeconds * 1000
        : OAUTH_TOKEN_DEFAULT_TTL_MS;

    cached = { accessToken: token.accessToken, expiresAt: now() + ttl };
    negativeCache = undefined;

    return token.accessToken;
  };

  return {
    getToken: () => {
      const currentTime = now();

      if (negativeCache && currentTime < negativeCache.until) {
        if (negativeCache.fallbackToCached && cached && currentTime < cached.expiresAt) {
          return Promise.resolve(cached.accessToken);
        }
        return Promise.reject(negativeCache.error);
      }

      if (cached && currentTime < cached.expiresAt - OAUTH_TOKEN_EXPIRY_SKEW_MS) {
        return Promise.resolve(cached.accessToken);
      }

      // Single-flight: every caller that arrives while a refresh is running shares it.
      inflight ??= requestToken().finally(() => {
        inflight = undefined;
      });

      return inflight;
    },
    invalidate: (usedToken: string) => {
      if (cached?.accessToken === usedToken) {
        cached = undefined;
      }
    },
  };
};

const withBearer = (init: RequestInit | undefined, token: string): RequestInit => {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return { ...init, headers };
};

/**
 * A `fetch` for the AI SDK that authenticates every request with a token from `source`, and on a
 * 401 refreshes the token and retries once. A 403 is returned as-is: gateways use it for
 * "authenticated but not allowed", which a new token does not fix.
 */
export const createOAuthFetch = (source: OAuthTokenSource): typeof fetch => {
  return async (input, init) => {
    const token = await source.getToken();
    const response = await globalThis.fetch(input, withBearer(init, token));

    if (response.status !== 401) {
      return response;
    }

    // A stream body has been consumed by the first attempt and cannot be replayed.
    if (init?.body instanceof ReadableStream) {
      return response;
    }

    source.invalidate(token);
    const freshToken = await source.getToken();

    if (freshToken === token) {
      return response;
    }

    // Release the rejected response's connection before the retry takes another one.
    await response.body?.cancel();

    return globalThis.fetch(input, withBearer(init, freshToken));
  };
};
