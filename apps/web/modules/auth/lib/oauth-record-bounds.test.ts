import { APIError } from "better-auth/api";
import { describe, expect, test } from "vitest";
import {
  OAUTH_AUTHORIZE_PARAMS_MAX_BYTES,
  OAUTH_CALLBACK_URL_MAX_BYTES,
  OAUTH_QUERY_MAX_BYTES,
  boundOAuthRecordsBeforeHandler,
} from "./oauth-record-bounds";

type TCtx = Parameters<typeof boundOAuthRecordsBeforeHandler>[0];

/** The error the hook throws for `ctx`, or `undefined` when it lets the request through. */
const refusal = (ctx: TCtx): APIError | undefined => {
  try {
    boundOAuthRecordsBeforeHandler(ctx);
    return undefined;
  } catch (error) {
    if (error instanceof APIError) return error;
    throw error;
  }
};

const socialStart = (body: unknown) => refusal({ path: "/sign-in/social", method: "POST", body });

const callbackAtLimit = `/${"a".repeat(OAUTH_CALLBACK_URL_MAX_BYTES - 1)}`;
const callbackOverLimit = `${callbackAtLimit}a`;
// `x=` plus padding re-encodes to itself, so its length is the stored length.
const queryAtLimit = `x=${"a".repeat(OAUTH_QUERY_MAX_BYTES - 2)}`;

describe("boundOAuthRecordsBeforeHandler: the OAuth state record (ENG-6885)", () => {
  test.each(["/sign-in/social", "/link-social"])("lets an honest %s request through", (path) => {
    const body = {
      provider: "google",
      callbackURL: "/environments/abc?source=signin",
      errorCallbackURL: "/auth/login",
    };
    expect(refusal({ path, method: "POST", body })).toBeUndefined();
  });

  test.each(["/sign-in/social", "/link-social"])("refuses additionalData on %s, even empty", (path) => {
    const error = refusal({ path, method: "POST", body: { provider: "google", additionalData: {} } });
    expect(error?.statusCode).toBe(400);
    expect(error?.body).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "additionalData is not supported",
    });
  });

  test.each(["callbackURL", "errorCallbackURL", "newUserCallbackURL"])(
    "accepts %s at the limit and answers 413 one byte over",
    (field) => {
      expect(socialStart({ provider: "google", [field]: callbackAtLimit })).toBeUndefined();

      const error = socialStart({ provider: "google", [field]: callbackOverLimit });
      expect(error?.statusCode).toBe(413);
      expect(error?.body).toMatchObject({
        code: "PAYLOAD_TOO_LARGE",
        message: `${field} must not exceed ${OAUTH_CALLBACK_URL_MAX_BYTES} bytes`,
      });
    }
  );

  test("counts UTF-8 bytes, not characters", () => {
    // 2,731 three-byte characters: under the limit in characters, over it in bytes.
    const multiByte = `/${"€".repeat(Math.ceil(OAUTH_CALLBACK_URL_MAX_BYTES / 3))}`;
    expect(multiByte.length).toBeLessThan(OAUTH_CALLBACK_URL_MAX_BYTES);
    expect(socialStart({ provider: "google", callbackURL: multiByte })?.statusCode).toBe(413);
  });

  test("counts a callback URL's quotes as the escaped bytes Redis holds", () => {
    // 2,049 raw bytes, 8,193 stored: each `"` is escaped twice, to 4 bytes.
    const quoted = `/${'"'.repeat(OAUTH_CALLBACK_URL_MAX_BYTES / 4)}`;
    expect(socialStart({ provider: "google", callbackURL: quoted })?.statusCode).toBe(413);
  });

  test("leaves other paths' callback URLs alone", () => {
    const body = { callbackURL: callbackOverLimit, additionalData: {} };
    expect(refusal({ path: "/sign-in/email", method: "POST", body })).toBeUndefined();
  });

  test.each([undefined, null, "text", 42])("leaves a body of %s to the endpoint's schema", (body) => {
    expect(socialStart(body)).toBeUndefined();
  });

  test("leaves a non-string callback URL to the endpoint's schema", () => {
    expect(socialStart({ provider: "google", callbackURL: 42 })).toBeUndefined();
  });
});

describe("boundOAuthRecordsBeforeHandler: the signed oauth_query, on any path (ENG-6885, ENG-7396)", () => {
  test.each(["/sign-in/social", "/oauth2/consent", "/oauth2/continue", "/sign-in/email"])(
    "accepts it at the limit on %s and answers 413 one byte over",
    (path) => {
      expect(refusal({ path, method: "POST", body: { oauth_query: queryAtLimit } })).toBeUndefined();

      const error = refusal({ path, method: "POST", body: { oauth_query: `${queryAtLimit}a` } });
      expect(error?.statusCode).toBe(413);
      expect(error?.body).toMatchObject({
        code: "PAYLOAD_TOO_LARGE",
        message: `oauth_query must not exceed ${OAUTH_QUERY_MAX_BYTES} bytes`,
      });
    }
  );

  test.each([
    ["pairs", [["client_id", "x"]]],
    ["an object", { client_id: "x" }],
    ["a number", 42],
    ["null", null],
  ])("refuses one given as %s", (_, oauthQuery) => {
    const error = socialStart({ provider: "google", oauth_query: oauthQuery });
    expect(error?.statusCode).toBe(400);
    expect(error?.body).toMatchObject({ code: "VALIDATION_ERROR", message: "oauth_query must be a string" });
  });

  test("refuses a raw query over the limit even when it would re-encode shorter", () => {
    // `%61` re-encodes to `a`: 18,002 bytes as sent, 6,002 re-encoded. Honest signed queries are canonical.
    const nonCanonical = `x=${"%61".repeat(6_000)}`;
    expect(
      refusal({ path: "/sign-in/social", method: "POST", body: { oauth_query: nonCanonical } })?.statusCode
    ).toBe(413);
  });

  test("counts it re-encoded, the form oauth-provider stores", () => {
    // A literal `"` comes back as `%22`: 6,002 raw bytes, over 18 KB stored.
    const quoted = `x=${'"'.repeat(6_000)}`;
    expect(
      refusal({ path: "/oauth2/consent", method: "POST", body: { oauth_query: quoted } })?.statusCode
    ).toBe(413);
  });
});

describe("boundOAuthRecordsBeforeHandler: the authorization-code record (ENG-7396)", () => {
  const authorize = (ctx: Omit<TCtx, "path">) => refusal({ path: "/oauth2/authorize", ...ctx });
  const honest = {
    response_type: "code",
    client_id: "client",
    redirect_uri: "http://127.0.0.1:33418/callback",
    scope: "surveys:read offline_access",
    state: "state",
  };
  // `{"x":""}` is 12 bytes as stored: 8, plus a backslash before each of its 4 quotes.
  const padded = (bytes: number) => ({ x: "a".repeat(bytes - 12) });
  const over = padded(OAUTH_AUTHORIZE_PARAMS_MAX_BYTES + 1);

  test("lets an honest request through, from the query or the body", () => {
    expect(authorize({ method: "GET", query: honest })).toBeUndefined();
    expect(authorize({ method: "POST", body: honest, query: {} })).toBeUndefined();
  });

  test.each([
    ["the query of a GET", { method: "GET", query: over }],
    ["the body of a POST", { method: "POST", body: over, query: {} }],
    [
      "the replayed query of a resumed authorize",
      { method: "POST", authorizeSettings: {}, query: over, body: {} },
    ],
  ])("refuses parameters over the limit in %s, as an OAuth invalid_request", (_, ctx) => {
    const error = authorize(ctx);
    expect(error?.statusCode).toBe(400);
    expect(error?.body).toMatchObject({
      error: "invalid_request",
      error_description: `Authorization request parameters must not exceed ${OAUTH_AUTHORIZE_PARAMS_MAX_BYTES} bytes`,
    });
  });

  test("accepts parameters exactly at the limit", () => {
    expect(authorize({ method: "POST", body: padded(OAUTH_AUTHORIZE_PARAMS_MAX_BYTES) })).toBeUndefined();
  });

  test("counts control characters as the escaped bytes Redis holds", () => {
    // 1,200 raw bytes, 8,400 stored: `\u0001` is escaped twice, to 7 bytes.
    expect(authorize({ method: "GET", query: { state: "\u0001".repeat(1_200) } })?.statusCode).toBe(400);
  });

  test("counts the JSON around every parameter, so many short keys cost more than their text", () => {
    // 700 keys of 3–4 bytes with empty values: about 2.6 KB of text, about 9.4 KB stored.
    const manyKeys = Object.fromEntries(
      Array.from({ length: 700 }, (_, i) => [`k${String(i).padStart(2, "0")}`, ""])
    );
    expect(authorize({ method: "POST", body: manyKeys })?.statusCode).toBe(400);
  });

  test("counts only what the endpoint reads", () => {
    // A resumed authorize reads the replayed query; the body is the calling route's (consent, sign-in),
    // carrying the signed `oauth_query`, and is not stored.
    expect(authorize({ method: "POST", authorizeSettings: {}, query: honest, body: over })).toBeUndefined();
    // An HTTP POST reads its body; a GET its query.
    expect(authorize({ method: "POST", body: honest, query: over })).toBeUndefined();
    expect(authorize({ method: "GET", query: honest, body: over })).toBeUndefined();
  });

  test("leaves other paths' parameters alone", () => {
    expect(refusal({ path: "/oauth2/token", method: "POST", body: over })).toBeUndefined();
  });
});
