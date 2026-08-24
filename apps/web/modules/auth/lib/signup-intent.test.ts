import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, test, vi } from "vitest";

const NEXTAUTH_SECRET = "test-nextauth-secret";
// 32 bytes hex — symmetricEncrypt/symmetricDecrypt expect a 64-char key.
const ENCRYPTION_KEY = "0".repeat(64);

vi.mock("@/lib/constants", () => ({ NEXTAUTH_SECRET, ENCRYPTION_KEY, BETTER_AUTH_SECRET: undefined }));
vi.mock("@/lib/env", () => ({ env: { WEBAPP_URL: "http://localhost:3000" } }));

const { createSignupIntentToken, readSignupIntentUserId, SIGNUP_INTENT_COOKIE_NAME } =
  await import("./signup-intent");
const { symmetricEncrypt } = await import("@/lib/crypto");

describe("signup intent token", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  test("round-trips the user id it was issued for", () => {
    const token = createSignupIntentToken("user_1");

    expect(readSignupIntentUserId(token)).toBe("user_1");
  });

  test("does not carry the user id in the clear", () => {
    // The cookie is httpOnly, but it is still a value that reaches the client. The id is encrypted in
    // the payload rather than merely base64'd with the rest of the JWT.
    expect(createSignupIntentToken("user_1")).not.toContain("user_1");
  });

  test.each([
    ["absent", undefined],
    ["empty", ""],
    ["not a jwt", "not-a-jwt"],
  ])("refuses %s cookie values", (_label, value) => {
    expect(readSignupIntentUserId(value)).toBeNull();
  });

  test("refuses a token signed with a different secret", () => {
    const forged = jwt.sign(
      { id: symmetricEncrypt("user_1", ENCRYPTION_KEY), purpose: "signup_intent" },
      "not-our-secret",
      { algorithm: "HS256" }
    );

    expect(readSignupIntentUserId(forged)).toBeNull();
  });

  test("refuses an expired token", () => {
    const token = createSignupIntentToken("user_1");

    // The TTL is one hour; jump past it rather than sleeping.
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 61 * 60 * 1000);

    expect(readSignupIntentUserId(token)).toBeNull();
  });

  test("refuses an unsigned (alg: none) token", () => {
    // Guard, not a proof of the `algorithms: ["HS256"]` pin: jsonwebtoken already refuses `none`
    // whenever a string secret is supplied, so this test stays green with the pin removed (verified by
    // mutation). The pin is kept as defence-in-depth against algorithm confusion should this ever be
    // handed a key object instead of a secret string — it is simply not what this row binds.
    const unsigned = jwt.sign(
      { id: symmetricEncrypt("user_1", ENCRYPTION_KEY), purpose: "signup_intent" },
      "",
      { algorithm: "none" }
    );

    expect(readSignupIntentUserId(unsigned)).toBeNull();
  });

  // The point of keeping `signup_intent` out of VERIFICATION_TOKEN_PURPOSES: a token minted by any
  // other flow, even correctly signed with the same secret, must not be spendable here.
  test.each([["email_verification"], ["sso_recovery"], [undefined]])(
    "refuses a correctly-signed token whose purpose is %s",
    (purpose) => {
      const otherFlowToken = jwt.sign(
        { id: symmetricEncrypt("user_1", ENCRYPTION_KEY), purpose },
        NEXTAUTH_SECRET,
        { algorithm: "HS256" }
      );

      expect(readSignupIntentUserId(otherFlowToken)).toBeNull();
    }
  );

  test("cookie name is namespaced so it cannot collide with a Better Auth cookie", () => {
    expect(SIGNUP_INTENT_COOKIE_NAME).toBe("formbricks.signup_intent");
  });
});
