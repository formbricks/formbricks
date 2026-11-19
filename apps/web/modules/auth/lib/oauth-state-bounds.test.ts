import { APIError } from "better-auth/api";
import { describe, expect, test } from "vitest";
import { OAUTH_CALLBACK_URL_MAX_BYTES, boundOAuthStateBeforeHandler } from "./oauth-state-bounds";

const atLimit = `/${"a".repeat(OAUTH_CALLBACK_URL_MAX_BYTES - 1)}`;
const overLimit = `${atLimit}a`;

const refusal = (path: string, body: unknown): APIError | undefined => {
  try {
    boundOAuthStateBeforeHandler({ path, body });
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

  test("leaves a non-string callback URL to the endpoint's schema", () => {
    expect(refusal("/sign-in/social", { provider: "google", callbackURL: 42 })).toBeUndefined();
  });
});
