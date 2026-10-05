import { Buffer } from "node:buffer";
import { AIOAuthTokenError, type AIOAuthTokenErrorCode } from "./errors";

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
/**
 * Ceiling on `expires_in`. Without it an endpoint answering with a huge lifetime would make the
 * token effectively permanent and leave the 401 retry as the only refresh trigger.
 */
export const OAUTH_TOKEN_MAX_TTL_MS = 24 * 60 * 60_000;
/** How long a definitive rejection (4xx, malformed response) is replayed without calling the endpoint. */
export const OAUTH_TOKEN_NEGATIVE_CACHE_MS = 20_000;

interface CachedToken {
  accessToken: string;
  /** When a proactive refresh starts: `expiresAt` minus the skew. */
  refreshAt: number;
  /** When the token stops being usable at all. */
  expiresAt: number;
}

interface NegativeCacheEntry {
  error: AIOAuthTokenError;
  until: number;
}

/**
 * The refresh point for a token of lifetime `ttl`. The skew is capped at half the lifetime, or a
 * token shorter than the skew would be due for refresh the moment it arrived — one token request
 * per AI call, which is the mint storm this module exists to prevent.
 */
const getRefreshSkew = (ttl: number): number => Math.min(OAUTH_TOKEN_EXPIRY_SKEW_MS, ttl / 2);

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
   * How a failed token request is handled.
   *
   * Whatever the failure, an unexpired cached token is still served: a refresh is attempted ahead
   * of expiry, so the current token stays good until `expiresAt`, and the endpoint rejecting a *new*
   * token does not revoke the one already issued. Only once nothing usable is cached does the
   * failure reach the caller.
   *
   * A definitive answer (4xx, malformed response) or a throttle (429) is also negative-cached, so
   * the endpoint is left alone for the back-off window. A transport failure or a 5xx is not: the
   * next request should try again.
   */
  const fail = (error: AIOAuthTokenError, { backOff }: { backOff: boolean }): string => {
    const currentTime = now();

    if (backOff) {
      negativeCache = { error, until: currentTime + OAUTH_TOKEN_NEGATIVE_CACHE_MS };
    }

    if (cached && currentTime < cached.expiresAt) {
      return cached.accessToken;
    }

    throw error;
  };

  const classifyErrorStatus = (status: number): { code: AIOAuthTokenErrorCode; backOff: boolean } => {
    if (status === 429) return { code: "token_endpoint_throttled", backOff: true };
    if (status >= 500) return { code: "token_endpoint_unavailable", backOff: false };
    return { code: "token_request_failed", backOff: true };
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
      return fail(new AIOAuthTokenError(code, { tokenUrlHost }), { backOff: false });
    }

    if (!response.ok) {
      // A 3xx lands here too: redirects are not followed, see buildTokenRequestInit.
      const { code, backOff } = classifyErrorStatus(response.status);
      return fail(new AIOAuthTokenError(code, { statusCode: response.status, tokenUrlHost }), { backOff });
    }

    const token = await parseTokenResponse(response);

    if (!token) {
      return fail(new AIOAuthTokenError("token_response_invalid", { tokenUrlHost }), { backOff: true });
    }

    const ttl = Math.min(
      token.expiresInSeconds !== undefined && token.expiresInSeconds > 0
        ? token.expiresInSeconds * 1000
        : OAUTH_TOKEN_DEFAULT_TTL_MS,
      OAUTH_TOKEN_MAX_TTL_MS
    );
    const mintedAt = now();

    cached = {
      accessToken: token.accessToken,
      refreshAt: mintedAt + ttl - getRefreshSkew(ttl),
      expiresAt: mintedAt + ttl,
    };
    negativeCache = undefined;

    return token.accessToken;
  };

  return {
    getToken: () => {
      const currentTime = now();

      // Inside a back-off the endpoint is not contacted; the cached token is served while it lasts.
      if (negativeCache && currentTime < negativeCache.until) {
        if (cached && currentTime < cached.expiresAt) {
          return Promise.resolve(cached.accessToken);
        }
        return Promise.reject(negativeCache.error);
      }

      if (cached && currentTime < cached.refreshAt) {
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

/** The signal's reason when it is an Error, else the AbortError the platform would have thrown. */
const getAbortReason = (signal: AbortSignal): Error =>
  signal.reason instanceof Error
    ? signal.reason
    : new DOMException("The operation was aborted.", "AbortError");

/**
 * Settle `promise` as soon as `signal` aborts, without cancelling the work behind it. The token
 * request is shared by every concurrent caller, so one caller pressing Stop must only release that
 * caller — the refresh keeps running for the others.
 */
const raceWithSignal = <T>(promise: Promise<T>, signal: AbortSignal | null | undefined): Promise<T> => {
  if (!signal) {
    return promise;
  }

  if (signal.aborted) {
    return Promise.reject(getAbortReason(signal));
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => reject(getAbortReason(signal));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
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
 *
 * The caller's `signal` is raced against the token fetch, so an aborted generation returns at once
 * instead of waiting out a slow identity provider.
 */
export const createOAuthFetch = (source: OAuthTokenSource): typeof fetch => {
  return async (input, init) => {
    if (init?.signal?.aborted) {
      throw getAbortReason(init.signal);
    }

    const token = await raceWithSignal(source.getToken(), init?.signal);
    const response = await globalThis.fetch(input, withBearer(init, token));

    if (response.status !== 401) {
      return response;
    }

    // A stream body has been consumed by the first attempt and cannot be replayed.
    if (init?.body instanceof ReadableStream) {
      return response;
    }

    source.invalidate(token);
    const freshToken = await raceWithSignal(source.getToken(), init?.signal);

    if (freshToken === token) {
      return response;
    }

    // Release the rejected response's connection before the retry takes another one.
    await response.body?.cancel();

    return globalThis.fetch(input, withBearer(init, freshToken));
  };
};
