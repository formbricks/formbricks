import { APIError } from "better-auth/api";
import { describe, expect, test } from "vitest";
import {
  OAUTH_AUTHORIZE_PARAMS_MAX_BYTES,
  OAUTH_CALLBACK_URL_MAX_BYTES,
  OAUTH_QUERY_MAX_BYTES,
  boundOAuthStateBeforeHandler,
} from "./oauth-state-bounds";

const atLimit = `/${"a".repeat(OAUTH_CALLBACK_URL_MAX_BYTES - 1)}`;
const overLimit = `${atLimit}a`;

const refusal = (path: string, body: unknown, query?: unknown): APIError | undefined => {
  try {
    boundOAuthStateBeforeHandler({ path, body, query });
    return undefined;
  } catch (error) {
    return error as APIError;
  }
};

describe("boundOAuthStateBeforeHandler (ENG-6885)", () => {
  test.each(["/sign-in/social", "/link-social"])("lets an honest %s request through", (path) => {
    expect(
      refusal(path, {
        provider: "google",
        callbackURL: "/environments/abc?source=signin",
        errorCallbackURL: "/auth/login",
      })
    ).toBeUndefined();
  });

  test.each(["/sign-in/social", "/link-social"])("refuses additionalData on %s, even empty", (path) => {
    const error = refusal(path, { provider: "google", additionalData: {} });
    expect(error).toBeInstanceOf(APIError);
    expect(error?.statusCode).toBe(400);
    expect(error?.body).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "additionalData is not supported",
    });
  });

  test.each(["callbackURL", "errorCallbackURL", "newUserCallbackURL"])(
    "accepts %s at the limit and refuses one byte over",
    (field) => {
      expect(refusal("/sign-in/social", { provider: "google", [field]: atLimit })).toBeUndefined();

      const error = refusal("/sign-in/social", { provider: "google", [field]: overLimit });
      expect(error?.statusCode).toBe(400);
      expect(error?.body).toMatchObject({
        code: "VALIDATION_ERROR",
        message: `${field} must not exceed ${OAUTH_CALLBACK_URL_MAX_BYTES} bytes`,
      });
    }
  );

  test("accepts a signed oauth_query at its limit and refuses one byte over", () => {
    // `x=` plus padding re-encodes to itself, so its length is the stored length.
    const query = `x=${"a".repeat(OAUTH_QUERY_MAX_BYTES - 2)}`;
    expect(refusal("/sign-in/social", { provider: "google", oauth_query: query })).toBeUndefined();

    const error = refusal("/sign-in/social", { provider: "google", oauth_query: `${query}a` });
    expect(error?.statusCode).toBe(400);
    expect(error?.body).toMatchObject({
      code: "VALIDATION_ERROR",
      message: `oauth_query must not exceed ${OAUTH_QUERY_MAX_BYTES} bytes`,
    });
  });

  test("counts UTF-8 bytes, not characters", () => {
    // 2,731 three-byte characters: under the limit in characters, over it in bytes.
    const multiByte = `/${"€".repeat(Math.ceil(OAUTH_CALLBACK_URL_MAX_BYTES / 3))}`;
    expect(multiByte.length).toBeLessThan(OAUTH_CALLBACK_URL_MAX_BYTES);
    expect(refusal("/sign-in/social", { provider: "google", callbackURL: multiByte })?.statusCode).toBe(400);
  });

  test("leaves other paths alone", () => {
    expect(refusal("/sign-in/email", { callbackURL: overLimit, additionalData: {} })).toBeUndefined();
  });

  test.each([undefined, null, "text", 42])("leaves a body of %s to the endpoint's schema", (body) => {
    expect(refusal("/sign-in/social", body)).toBeUndefined();
  });

  test.each([
    ["pairs", [["client_id", "x"]]],
    ["an object", { client_id: "x" }],
    ["a number", 42],
  ])("refuses an oauth_query given as %s", (_, oauthQuery) => {
    const error = refusal("/sign-in/social", { provider: "google", oauth_query: oauthQuery });
    expect(error?.statusCode).toBe(400);
    expect(error?.body).toMatchObject({ code: "VALIDATION_ERROR", message: "oauth_query must be a string" });
  });

  test("leaves a non-string callback URL to the endpoint's schema", () => {
    expect(refusal("/sign-in/social", { provider: "google", callbackURL: 42 })).toBeUndefined();
  });
});

describe("boundOAuthStateBeforeHandler: signed oauth_query on any path (ENG-6885, ENG-7396)", () => {
  test.each(["/oauth2/consent", "/oauth2/continue", "/sign-in/email"])("caps oauth_query on %s", (path) => {
    const query = `x=${"a".repeat(OAUTH_QUERY_MAX_BYTES - 2)}`;
    expect(refusal(path, { oauth_query: query })).toBeUndefined();
    expect(refusal(path, { oauth_query: `${query}a` })?.statusCode).toBe(400);
    expect(refusal(path, { oauth_query: [["sig", "x"]] })?.body).toMatchObject({
      message: "oauth_query must be a string",
    });
  });
});

describe("boundOAuthStateBeforeHandler: size as stored (ENG-6885, ENG-7396)", () => {
  test("counts a callback URL's quotes as the escaped bytes Redis holds", () => {
    // 2,049 raw bytes, 8,193 stored: each `"` is escaped twice, to 4 bytes.
    const quoted = `/${'"'.repeat(OAUTH_CALLBACK_URL_MAX_BYTES / 4)}`;
    expect(refusal("/sign-in/social", { provider: "google", callbackURL: quoted })?.statusCode).toBe(400);
  });

  test("counts oauth_query re-encoded, the form oauth-provider stores", () => {
    // A literal `"` comes back as `%22`: 6,002 raw bytes, over 18 KB stored.
    const quoted = `x=${'"'.repeat(6_000)}`;
    expect(refusal("/oauth2/consent", { oauth_query: quoted })?.statusCode).toBe(400);
  });
});

describe("boundOAuthStateBeforeHandler: /oauth2/authorize (ENG-7396)", () => {
  type TCtx = Parameters<typeof boundOAuthStateBeforeHandler>[0];
  const authorizeRefusal = (ctx: Omit<TCtx, "path">): APIError | undefined => {
    try {
      boundOAuthStateBeforeHandler({ path: "/oauth2/authorize", ...ctx });
      return undefined;
    } catch (error) {
      return error as APIError;
    }
  };
  const honest = {
    response_type: "code",
    client_id: "client",
    redirect_uri: "http://127.0.0.1:33418/callback",
    scope: "surveys:read offline_access",
    state: "state",
  };
  // The name `x` is one byte.
  const padded = (bytes: number) => ({ x: "a".repeat(bytes - 1) });
  const over = padded(OAUTH_AUTHORIZE_PARAMS_MAX_BYTES + 1);

  test("lets an honest request through, from the query or the body", () => {
    expect(authorizeRefusal({ method: "GET", query: honest })).toBeUndefined();
    expect(authorizeRefusal({ method: "POST", body: honest, query: {} })).toBeUndefined();
  });

  test.each([
    ["the query of a GET", { method: "GET", query: over }],
    ["the body of a POST", { method: "POST", body: over, query: {} }],
    [
      "the replayed query of a resumed authorize",
      { method: "POST", authorizeSettings: {}, query: over, body: {} },
    ],
  ])("refuses parameters over the limit in %s, as an OAuth error", (_, ctx) => {
    const error = authorizeRefusal(ctx);
    expect(error?.statusCode).toBe(400);
    expect(error?.body).toMatchObject({ code: "VALIDATION_ERROR", error: "invalid_request" });
  });

  test("accepts parameters exactly at the limit", () => {
    expect(
      authorizeRefusal({ method: "POST", body: padded(OAUTH_AUTHORIZE_PARAMS_MAX_BYTES) })
    ).toBeUndefined();
  });

  test("counts control characters as the escaped bytes Redis holds", () => {
    // 1,200 raw bytes, 8,400 stored: `\u0001` is escaped twice, to 7 bytes.
    expect(authorizeRefusal({ method: "GET", query: { state: "\u0001".repeat(1_200) } })?.statusCode).toBe(
      400
    );
  });

  test("counts only what the endpoint reads", () => {
    // A resumed authorize reads the replayed query; the body is the calling route's (consent, sign-in),
    // carrying the signed `oauth_query`, and is not stored.
    expect(
      authorizeRefusal({ method: "POST", authorizeSettings: {}, query: honest, body: over })
    ).toBeUndefined();
    // An HTTP POST reads its body; a GET its query.
    expect(authorizeRefusal({ method: "POST", body: honest, query: over })).toBeUndefined();
    expect(authorizeRefusal({ method: "GET", query: honest, body: over })).toBeUndefined();
  });

  test("leaves other paths' parameters alone", () => {
    expect(refusal("/oauth2/token", over, {})).toBeUndefined();
  });
});
