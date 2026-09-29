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
   * A definitive failure (4xx, malformed response) is negative-cached and thrown. A transient one
   * (timeout, network, 5xx) is thrown too — unless the refresh started inside the expiry skew and
   * the cached token has not actually expired yet, in which case that token is still good to use.
   */
  const fail = (error: AIOAuthTokenError, { transient }: { transient: boolean }): string => {
    const currentTime = now();

    if (!transient) {
      negativeCache = { error, until: currentTime + OAUTH_TOKEN_NEGATIVE_CACHE_MS };
    } else if (cached && currentTime < cached.expiresAt) {
      return cached.accessToken;
    }

    throw error;
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
      return fail(new AIOAuthTokenError(code, { tokenUrlHost }), { transient: true });
    }

    if (!response.ok) {
      // A 4xx is the endpoint's definitive answer (bad credentials, unknown scope); a 5xx is transient.
      return fail(
        new AIOAuthTokenError("token_request_failed", { statusCode: response.status, tokenUrlHost }),
        { transient: response.status >= 500 }
      );
    }

    const token = await parseTokenResponse(response);

    if (!token) {
      return fail(new AIOAuthTokenError("token_response_invalid", { tokenUrlHost }), { transient: false });
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
