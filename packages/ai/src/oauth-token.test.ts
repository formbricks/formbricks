import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AIOAuthTokenError } from "./errors";
import {
  OAUTH_TOKEN_DEFAULT_TTL_MS,
  OAUTH_TOKEN_EXPIRY_SKEW_MS,
  OAUTH_TOKEN_MAX_TTL_MS,
  OAUTH_TOKEN_NEGATIVE_CACHE_MS,
  OAUTH_TOKEN_REQUEST_TIMEOUT_MS,
  type OAuthClientCredentialsConfig,
  type OAuthTokenSource,
  createOAuthFetch,
  createOAuthTokenSource,
} from "./oauth-token";

const TOKEN_URL = "https://idp.example.internal/oauth/token";

const baseConfig: OAuthClientCredentialsConfig = {
  tokenUrl: TOKEN_URL,
  clientId: "test-client",
  clientSecret: "test-secret",
  authStyle: "basic",
};

const tokenResponse = (accessToken: string, extra: Record<string, unknown> = { expires_in: 600 }): Response =>
  new Response(JSON.stringify({ access_token: accessToken, token_type: "Bearer", ...extra }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

// A token endpoint that mints tok-1, tok-2, … on each call.
const createMintingFetch = (extra?: Record<string, unknown>) => {
  let counter = 0;
  return vi.fn((_input: RequestInfo | URL, _init?: RequestInit) => {
    counter += 1;
    return Promise.resolve(tokenResponse(`tok-${counter}`, extra));
  });
};

const createClock = (start = 1_000_000) => {
  let current = start;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
};

const getInit = (fetchMock: ReturnType<typeof vi.fn>, call = 0): RequestInit =>
  fetchMock.mock.calls[call][1] as RequestInit;

const getBody = (fetchMock: ReturnType<typeof vi.fn>, call = 0): URLSearchParams =>
  new URLSearchParams(getInit(fetchMock, call).body as string);

describe("createOAuthTokenSource", () => {
  test("mints a new token once the cached one reaches the expiry skew", async () => {
    const clock = createClock();
    const fetchMock = createMintingFetch({ expires_in: 120 });
    const source = createOAuthTokenSource(baseConfig, { fetch: fetchMock, now: clock.now });

    await expect(source.getToken()).resolves.toBe("tok-1");
    clock.advance(120_000 - OAUTH_TOKEN_EXPIRY_SKEW_MS - 1);
    await expect(source.getToken()).resolves.toBe("tok-1");
    clock.advance(1);
    await expect(source.getToken()).resolves.toBe("tok-2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("shares one token request between concurrent callers on a cold cache", async () => {
    const fetchMock = createMintingFetch();
    const source = createOAuthTokenSource(baseConfig, { fetch: fetchMock });

    const tokens = await Promise.all(Array.from({ length: 20 }, () => source.getToken()));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new Set(tokens)).toEqual(new Set(["tok-1"]));
  });

  test("shares one refresh between concurrent callers at the expiry boundary", async () => {
    const clock = createClock();
    const fetchMock = createMintingFetch({ expires_in: 120 });
    const source = createOAuthTokenSource(baseConfig, { fetch: fetchMock, now: clock.now });

    await source.getToken();
    clock.advance(120_000);
    const tokens = await Promise.all(Array.from({ length: 20 }, () => source.getToken()));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new Set(tokens)).toEqual(new Set(["tok-2"]));
  });

  test("gives the token request its own timeout signal", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    const fetchMock = createMintingFetch();
    const source = createOAuthTokenSource(baseConfig, { fetch: fetchMock });

    await source.getToken();

    expect(timeoutSpy).toHaveBeenCalledWith(OAUTH_TOKEN_REQUEST_TIMEOUT_MS);
    expect(getInit(fetchMock).signal).toBe(timeoutSpy.mock.results[0].value);
    timeoutSpy.mockRestore();
  });

  test("rejects with token_endpoint_timeout when the endpoint hangs past the timeout", async () => {
    const controller = new AbortController();
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason as Error));
        })
    );
    const source = createOAuthTokenSource(baseConfig, { fetch: fetchMock });

    const pending = source.getToken();
    controller.abort(new DOMException("The operation timed out.", "TimeoutError"));

    await expect(pending).rejects.toMatchObject({ code: "token_endpoint_timeout" });
    timeoutSpy.mockRestore();

    // Not negative-cached: the next call tries again.
    fetchMock.mockResolvedValueOnce(tokenResponse("tok-after-timeout"));
    await expect(source.getToken()).resolves.toBe("tok-after-timeout");
  });

  test("negative-caches a 4xx for the negative-cache window", async () => {
    const clock = createClock();
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response('{"error":"invalid_client"}', { status: 400 }))
    );
    const source = createOAuthTokenSource(baseConfig, { fetch: fetchMock, now: clock.now });

    await expect(source.getToken()).rejects.toMatchObject({ code: "token_request_failed", statusCode: 400 });
    clock.advance(OAUTH_TOKEN_NEGATIVE_CACHE_MS - 1);
    await expect(source.getToken()).rejects.toMatchObject({ code: "token_request_failed" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    clock.advance(1);
    await expect(source.getToken()).rejects.toBeInstanceOf(AIOAuthTokenError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("does not negative-cache a 5xx", async () => {
    const fetchMock = vi
      .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(tokenResponse("tok-1"));
    const source = createOAuthTokenSource(baseConfig, { fetch: fetchMock });

    await expect(source.getToken()).rejects.toMatchObject({
      code: "token_endpoint_unavailable",
      statusCode: 503,
    });
    await expect(source.getToken()).resolves.toBe("tok-1");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("backs off a 429 for the negative-cache window and keeps the unexpired cached token", async () => {
    const clock = createClock();
    const fetchMock = vi
      .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(tokenResponse("tok-1", { expires_in: 120 }))
      .mockResolvedValue(new Response('{"error":"slow_down"}', { status: 429 }));
    const source = createOAuthTokenSource(baseConfig, { fetch: fetchMock, now: clock.now });

    await source.getToken();
    clock.advance(120_000 - OAUTH_TOKEN_EXPIRY_SKEW_MS);

    // Throttled inside the skew: the still-valid token is reused and the endpoint is left alone
    // for the back-off window.
    await expect(source.getToken()).resolves.toBe("tok-1");
    await expect(source.getToken()).resolves.toBe("tok-1");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Back-off over, token still has 10s: one more attempt, throttled again, token reused again.
    clock.advance(OAUTH_TOKEN_EXPIRY_SKEW_MS - 10_000);
    await expect(source.getToken()).resolves.toBe("tok-1");
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Token expired while the new back-off still holds: nothing to fall back to, endpoint left alone.
    clock.advance(10_000);
    await expect(source.getToken()).rejects.toMatchObject({
      code: "token_endpoint_throttled",
      statusCode: 429,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    clock.advance(OAUTH_TOKEN_NEGATIVE_CACHE_MS - 10_000);
    await expect(source.getToken()).rejects.toMatchObject({ statusCode: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  test("does not follow redirects and treats a 307 from the token endpoint as a definitive failure", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(null, { status: 307, headers: { Location: "https://elsewhere.example/" } })
      )
    );
    const source = createOAuthTokenSource({ ...baseConfig, authStyle: "post" }, { fetch: fetchMock });

    await expect(source.getToken()).rejects.toMatchObject({ code: "token_request_failed", statusCode: 307 });
    expect(getInit(fetchMock).redirect).toBe("manual");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("falls back to the unexpired cached token when a refresh inside the skew fails transiently", async () => {
    const clock = createClock();
    const fetchMock = vi
      .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(tokenResponse("tok-1", { expires_in: 120 }))
      .mockRejectedValue(new TypeError("fetch failed"));
    const source = createOAuthTokenSource(baseConfig, { fetch: fetchMock, now: clock.now });

    await source.getToken();
    clock.advance(120_000 - OAUTH_TOKEN_EXPIRY_SKEW_MS);
    await expect(source.getToken()).resolves.toBe("tok-1");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    clock.advance(OAUTH_TOKEN_EXPIRY_SKEW_MS);
    await expect(source.getToken()).rejects.toMatchObject({ code: "token_endpoint_unreachable" });
  });

  test("keeps serving the unexpired cached token when the refresh is rejected, and fails once it expires", async () => {
    const clock = createClock();
    const fetchMock = vi
      .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(tokenResponse("tok-1", { expires_in: 120 }))
      .mockResolvedValue(new Response("", { status: 401 }));
    const source = createOAuthTokenSource(baseConfig, { fetch: fetchMock, now: clock.now });

    await source.getToken();
    clock.advance(120_000 - OAUTH_TOKEN_EXPIRY_SKEW_MS);

    // The endpoint refusing a new token does not revoke the one already issued.
    await expect(source.getToken()).resolves.toBe("tok-1");
    await expect(source.getToken()).resolves.toBe("tok-1");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    clock.advance(OAUTH_TOKEN_EXPIRY_SKEW_MS);
    await expect(source.getToken()).rejects.toMatchObject({ code: "token_request_failed", statusCode: 401 });
  });

  test("reuses a short-lived token between sequential calls instead of minting per call", async () => {
    const clock = createClock();
    const fetchMock = createMintingFetch({ expires_in: 30 });
    const source = createOAuthTokenSource(baseConfig, { fetch: fetchMock, now: clock.now });

    for (let i = 0; i < 5; i += 1) {
      await expect(source.getToken()).resolves.toBe("tok-1");
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Skew is capped at half the lifetime: refresh at 15s, not "immediately" as a fixed 60s would give.
    clock.advance(15_000 - 1);
    await expect(source.getToken()).resolves.toBe("tok-1");
    clock.advance(1);
    await expect(source.getToken()).resolves.toBe("tok-2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("clamps an oversized expires_in to the maximum lifetime", async () => {
    const clock = createClock();
    const fetchMock = createMintingFetch({ expires_in: 1e12 });
    const source = createOAuthTokenSource(baseConfig, { fetch: fetchMock, now: clock.now });

    await source.getToken();
    clock.advance(OAUTH_TOKEN_MAX_TTL_MS - OAUTH_TOKEN_EXPIRY_SKEW_MS - 1);
    await expect(source.getToken()).resolves.toBe("tok-1");
    clock.advance(1);
    await expect(source.getToken()).resolves.toBe("tok-2");
  });

  test("ignores a stale invalidate once a successor token has been minted", async () => {
    const fetchMock = createMintingFetch();
    const source = createOAuthTokenSource(baseConfig, { fetch: fetchMock });

    await source.getToken();
    source.invalidate("tok-1");
    await expect(source.getToken()).resolves.toBe("tok-2");
    source.invalidate("tok-1");
    await expect(source.getToken()).resolves.toBe("tok-2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("keeps grant_type fixed when extraParams tries to override it", async () => {
    const fetchMock = createMintingFetch();
    const source = createOAuthTokenSource(
      { ...baseConfig, extraParams: { grant_type: "password", audience: "https://gw.example" } },
      { fetch: fetchMock }
    );

    await source.getToken();

    expect(getBody(fetchMock).get("grant_type")).toBe("client_credentials");
    expect(getBody(fetchMock).get("audience")).toBe("https://gw.example");
  });

  test("sends form-urlencoded client credentials in a Basic header per RFC 6749 §2.3.1", async () => {
    const fetchMock = createMintingFetch();
    const source = createOAuthTokenSource(
      { ...baseConfig, clientId: "id:x", clientSecret: "p+a/s:s", scope: "llm.read llm.write" },
      { fetch: fetchMock }
    );

    await source.getToken();

    const headers = getInit(fetchMock).headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Basic ${Buffer.from("id%3Ax:p%2Ba%2Fs%3As").toString("base64")}`);
    expect(headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    const body = getBody(fetchMock);
    expect(body.get("grant_type")).toBe("client_credentials");
    expect(body.get("scope")).toBe("llm.read llm.write");
    expect(body.has("client_secret")).toBe(false);
  });

  test("sends the credentials and extra params in the body in post style", async () => {
    const fetchMock = createMintingFetch();
    const source = createOAuthTokenSource(
      { ...baseConfig, authStyle: "post", extraParams: { audience: "https://gateway.example.internal" } },
      { fetch: fetchMock }
    );

    await source.getToken();

    const headers = getInit(fetchMock).headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
    const body = getBody(fetchMock);
    expect(body.get("client_id")).toBe("test-client");
    expect(body.get("client_secret")).toBe("test-secret");
    expect(body.get("audience")).toBe("https://gateway.example.internal");
    expect(body.has("scope")).toBe(false);
  });

  test("falls back to the default TTL when expires_in is missing", async () => {
    const clock = createClock();
    const fetchMock = createMintingFetch({});
    const source = createOAuthTokenSource(baseConfig, { fetch: fetchMock, now: clock.now });

    await source.getToken();
    clock.advance(OAUTH_TOKEN_DEFAULT_TTL_MS - OAUTH_TOKEN_EXPIRY_SKEW_MS - 1);
    await expect(source.getToken()).resolves.toBe("tok-1");
    clock.advance(1);
    await expect(source.getToken()).resolves.toBe("tok-2");
  });

  test.each([
    ["a non-bearer token type", { access_token: "tok", token_type: "MAC" }],
    ["no access_token", { token_type: "Bearer" }],
    ["a non-JSON body", "<html>login</html>"],
  ])("rejects a 2xx response with %s as token_response_invalid", async (_label, payload) => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(typeof payload === "string" ? payload : JSON.stringify(payload), { status: 200 })
      )
    );
    const source = createOAuthTokenSource(baseConfig, { fetch: fetchMock });

    await expect(source.getToken()).rejects.toMatchObject({ code: "token_response_invalid" });
    await expect(source.getToken()).rejects.toMatchObject({ code: "token_response_invalid" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("resolves globalThis.fetch at call time when no fetch is injected", async () => {
    const source = createOAuthTokenSource(baseConfig);
    const lateFetch = vi.fn(() => Promise.resolve(tokenResponse("tok-late")));
    vi.stubGlobal("fetch", lateFetch);

    await expect(source.getToken()).resolves.toBe("tok-late");
    expect(lateFetch).toHaveBeenCalledWith(TOKEN_URL, expect.anything());
    vi.unstubAllGlobals();
  });
});

describe("createOAuthFetch", () => {
  const MODEL_URL = "https://gateway.example.internal/v1/chat/completions";
  let modelFetch: ReturnType<
    typeof vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>
  >;

  const authorizationOf = (call: number): string | null =>
    new Headers(modelFetch.mock.calls[call][1]?.headers).get("Authorization");

  beforeEach(() => {
    modelFetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
    vi.stubGlobal("fetch", modelFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const createSource = (): {
    source: OAuthTokenSource;
    tokenFetch: ReturnType<typeof createMintingFetch>;
  } => {
    const tokenFetch = createMintingFetch();
    return { source: createOAuthTokenSource(baseConfig, { fetch: tokenFetch }), tokenFetch };
  };

  test("adds the bearer token and keeps the caller's headers and signal", async () => {
    const { source } = createSource();
    modelFetch.mockResolvedValue(new Response("ok"));
    const controller = new AbortController();

    await createOAuthFetch(source)(MODEL_URL, {
      method: "POST",
      body: "{}",
      headers: { "X-Tenant": "t1" },
      signal: controller.signal,
    });

    const init = modelFetch.mock.calls[0][1];
    expect(new Headers(init?.headers).get("X-Tenant")).toBe("t1");
    expect(authorizationOf(0)).toBe("Bearer tok-1");
    expect(init?.signal).toBe(controller.signal);
  });

  test("does not hand the caller's signal to the token request", async () => {
    const { source, tokenFetch } = createSource();
    modelFetch.mockResolvedValue(new Response("ok"));
    const controller = new AbortController();

    await createOAuthFetch(source)(MODEL_URL, { body: "{}", signal: controller.signal });
    controller.abort();

    expect(getInit(tokenFetch).signal).not.toBe(controller.signal);
    expect(getInit(tokenFetch).signal?.aborted).toBe(false);
  });

  test("releases an aborted caller at once while the shared token request keeps running", async () => {
    let resolveToken!: (response: Response) => void;
    const tokenFetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveToken = resolve;
        })
    );
    const source = createOAuthTokenSource(baseConfig, { fetch: tokenFetch });
    modelFetch.mockResolvedValue(new Response("ok"));
    const oauthFetch = createOAuthFetch(source);
    const controller = new AbortController();

    const aborted = oauthFetch(MODEL_URL, { body: "{}", signal: controller.signal });
    const other = oauthFetch(MODEL_URL, { body: "{}" });
    controller.abort(new DOMException("stopped", "AbortError"));

    await expect(aborted).rejects.toMatchObject({ name: "AbortError" });
    expect(modelFetch).not.toHaveBeenCalled();

    resolveToken(tokenResponse("tok-1"));
    expect((await other).status).toBe(200);
    expect(tokenFetch).toHaveBeenCalledTimes(1);
    expect(getInit(tokenFetch).signal?.aborted).toBe(false);
  });

  test("does not start a token request for an already-aborted caller", async () => {
    const { source, tokenFetch } = createSource();
    const controller = new AbortController();
    controller.abort(new DOMException("stopped", "AbortError"));

    await expect(
      createOAuthFetch(source)(MODEL_URL, { body: "{}", signal: controller.signal })
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(tokenFetch).not.toHaveBeenCalled();
  });

  test("refreshes the token and retries once on a 401", async () => {
    const { source, tokenFetch } = createSource();
    modelFetch
      .mockResolvedValueOnce(new Response("expired", { status: 401 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const response = await createOAuthFetch(source)(MODEL_URL, { body: "{}" });

    expect(response.status).toBe(200);
    expect(tokenFetch).toHaveBeenCalledTimes(2);
    expect(authorizationOf(0)).toBe("Bearer tok-1");
    expect(authorizationOf(1)).toBe("Bearer tok-2");
  });

  test("returns the second 401 without looping", async () => {
    const { source, tokenFetch } = createSource();
    modelFetch.mockImplementation(() => Promise.resolve(new Response("nope", { status: 401 })));

    const response = await createOAuthFetch(source)(MODEL_URL, { body: "{}" });

    expect(response.status).toBe(401);
    expect(modelFetch).toHaveBeenCalledTimes(2);
    expect(tokenFetch).toHaveBeenCalledTimes(2);
  });

  test("does not retry or invalidate on a 403", async () => {
    const { source, tokenFetch } = createSource();
    modelFetch.mockResolvedValue(new Response("forbidden", { status: 403 }));
    const oauthFetch = createOAuthFetch(source);

    expect((await oauthFetch(MODEL_URL, { body: "{}" })).status).toBe(403);
    await oauthFetch(MODEL_URL, { body: "{}" });

    expect(modelFetch).toHaveBeenCalledTimes(2);
    expect(tokenFetch).toHaveBeenCalledTimes(1);
  });

  test("does not replay a stream body after a 401", async () => {
    const { source, tokenFetch } = createSource();
    modelFetch.mockResolvedValue(new Response("expired", { status: 401 }));

    const response = await createOAuthFetch(source)(MODEL_URL, { body: new ReadableStream() });

    expect(response.status).toBe(401);
    expect(modelFetch).toHaveBeenCalledTimes(1);
    expect(tokenFetch).toHaveBeenCalledTimes(1);
  });

  test("propagates a token failure without calling the model", async () => {
    const source = createOAuthTokenSource(baseConfig, {
      fetch: () => Promise.resolve(new Response("", { status: 401 })),
    });

    await expect(createOAuthFetch(source)(MODEL_URL, { body: "{}" })).rejects.toBeInstanceOf(
      AIOAuthTokenError
    );
    expect(modelFetch).not.toHaveBeenCalled();
  });

  test("uses a globalThis.fetch swapped in after creation", async () => {
    const { source } = createSource();
    const oauthFetch = createOAuthFetch(source);
    const swapped = vi.fn(() => Promise.resolve(new Response("swapped")));
    vi.stubGlobal("fetch", swapped);

    await oauthFetch(MODEL_URL, { body: "{}" });

    expect(swapped).toHaveBeenCalledTimes(1);
    expect(modelFetch).not.toHaveBeenCalled();
  });
});
