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
    const query = "a".repeat(OAUTH_QUERY_MAX_BYTES);
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
    const query = "a".repeat(OAUTH_QUERY_MAX_BYTES);
    expect(refusal(path, { oauth_query: query })).toBeUndefined();
    expect(refusal(path, { oauth_query: `${query}a` })?.statusCode).toBe(400);
    expect(refusal(path, { oauth_query: [["sig", "x"]] })?.body).toMatchObject({
      message: "oauth_query must be a string",
    });
  });
});

describe("boundOAuthStateBeforeHandler: /oauth2/authorize (ENG-7396)", () => {
  const honest = {
    response_type: "code",
    client_id: "client",
    redirect_uri: "http://127.0.0.1:33418/callback",
    scope: "surveys:read offline_access",
    state: "state",
  };
  // The name `x` is one byte.
  const padded = (bytes: number) => ({ x: "a".repeat(bytes - 1) });

  test("lets an honest request through, from the query or the body", () => {
    expect(refusal("/oauth2/authorize", undefined, honest)).toBeUndefined();
    expect(refusal("/oauth2/authorize", honest, {})).toBeUndefined();
  });

  test.each([
    ["the query (GET)", undefined, padded(OAUTH_AUTHORIZE_PARAMS_MAX_BYTES + 1)],
    ["the body (POST)", padded(OAUTH_AUTHORIZE_PARAMS_MAX_BYTES + 1), {}],
    [
      "query and body together",
      padded(OAUTH_AUTHORIZE_PARAMS_MAX_BYTES / 2 + 1),
      padded(OAUTH_AUTHORIZE_PARAMS_MAX_BYTES / 2),
    ],
  ])("refuses parameters over the limit in %s, as an OAuth error", (_, body, query) => {
    const error = refusal("/oauth2/authorize", body, query);
    expect(error?.statusCode).toBe(400);
    expect(error?.body).toMatchObject({ code: "VALIDATION_ERROR", error: "invalid_request" });
  });

  test("accepts parameters exactly at the limit", () => {
    expect(refusal("/oauth2/authorize", padded(OAUTH_AUTHORIZE_PARAMS_MAX_BYTES), {})).toBeUndefined();
  });

  test("leaves other paths' parameters alone", () => {
    expect(refusal("/oauth2/token", padded(OAUTH_AUTHORIZE_PARAMS_MAX_BYTES + 1), {})).toBeUndefined();
  });
});
