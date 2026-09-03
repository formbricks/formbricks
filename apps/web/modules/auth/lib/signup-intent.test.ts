import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, test, vi } from "vitest";

const NEXTAUTH_SECRET = "test-nextauth-secret";
// 32 bytes hex — symmetricEncrypt/symmetricDecrypt expect a 64-char key.
const ENCRYPTION_KEY = "0".repeat(64);

vi.mock("@/lib/constants", () => ({ NEXTAUTH_SECRET, ENCRYPTION_KEY, BETTER_AUTH_SECRET: undefined }));
vi.mock("@/lib/env", () => ({ env: { WEBAPP_URL: "http://localhost:3000" } }));
// Imported only so the boundary test below can call the REAL `verifyToken`; its gateway-auth import
// chain is irrelevant to that call and pulls in server env, so stub it.
vi.mock("@/modules/gateway-auth/lib/service", () => ({ getGatewayAuthServiceTokenPurpose: vi.fn() }));

const { createSignupIntentToken, readSignupIntent, classifySignupIntent, SIGNUP_INTENT_COOKIE_NAME } =
  await import("./signup-intent");
const { symmetricEncrypt } = await import("@/lib/crypto");

describe("signup intent token", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  test("round-trips the user id it was issued for", () => {
    const token = createSignupIntentToken("user_1");

    expect(readSignupIntent(token)).toEqual({ userId: "user_1", reason: "valid" });
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
    expect(readSignupIntent(value).userId).toBeNull();
  });

  test("refuses a token signed with a different secret", () => {
    const forged = jwt.sign(
      { id: symmetricEncrypt("user_1", ENCRYPTION_KEY), purpose: "signup_intent" },
      "not-our-secret",
      { algorithm: "HS256" }
    );

    expect(readSignupIntent(forged)).toEqual({ userId: null, reason: expect.any(String) });
  });

  test("refuses an expired token", () => {
    const token = createSignupIntentToken("user_1");

    // The TTL is one hour; jump past it rather than sleeping.
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 61 * 60 * 1000);

    expect(readSignupIntent(token)).toEqual({ userId: null, reason: expect.any(String) });
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

    expect(readSignupIntent(unsigned)).toEqual({ userId: null, reason: expect.any(String) });
  });

  // A token minted by any other flow, even correctly signed with the same secret, must not be
  // spendable here. `createToken` in lib/jwt.ts uses `id`/`purpose`, so such a token carries no
  // `kind` at all and is refused — which is the point of not sharing that claim shape.
  test.each([["email_verification"], ["sso_recovery"], [undefined]])(
    "refuses a correctly-signed lib/jwt.ts-shaped token whose purpose is %s",
    (purpose) => {
      const otherFlowToken = jwt.sign(
        { id: symmetricEncrypt("user_1", ENCRYPTION_KEY), purpose },
        NEXTAUTH_SECRET,
        { algorithm: "HS256" }
      );

      expect(readSignupIntent(otherFlowToken)).toEqual({ userId: null, reason: "invalid" });
    }
  );

  // Binds the `kind` check itself. The lib/jwt.ts-shaped rows above do not: those tokens carry no `uid`,
  // so they die on the uid check and stay refused even with the kind check deleted (verified by
  // mutation). Nothing mints a `uid`-carrying token today, which is exactly why this row exists — the
  // check is what keeps that true if something ever does.
  test.each([["other_kind"], [undefined], [""]])("refuses a uid-carrying token whose kind is %s", (kind) => {
    const wrongKind = jwt.sign({ uid: symmetricEncrypt("user_1", ENCRYPTION_KEY), kind }, NEXTAUTH_SECRET, {
      algorithm: "HS256",
    });

    expect(readSignupIntent(wrongKind)).toEqual({ userId: null, reason: "invalid" });
  });

  // The other direction, and the reason the claims are named `uid`/`kind`: `getVerificationTokenPurpose`
  // in lib/jwt.ts FAILS OPEN, rewriting an unrecognised purpose to "email_verification". Staying out of
  // VERIFICATION_TOKEN_PURPOSES is therefore not protection by itself — carrying no `id` claim is, since
  // `verifyToken` bails on `if (!payload?.id)` before any purpose is considered.
  test("is not parseable as a lib/jwt.ts verification token", async () => {
    const token = createSignupIntentToken("user_1");

    // The claim-shape half: no `id`, no `purpose`.
    const decoded = jwt.decode(token) as Record<string, unknown>;
    expect(decoded.id).toBeUndefined();
    expect(decoded.purpose).toBeUndefined();
    expect(decoded.kind).toBe("signup_intent");

    // And the boundary itself: the REAL verifier refuses the token. The signature is genuinely valid
    // to it (same secret on a NEXTAUTH_SECRET-only deployment), so what this binds is the
    // `if (!payload?.id)` bail-out — the layout assertions above would keep passing if `verifyToken`
    // ever started accepting `uid`/`kind`; this call would not.
    const { verifyToken } = await import("@/lib/jwt");
    await expect(verifyToken(token)).rejects.toThrow("Invalid token");
  });

  test("cookie name is namespaced so it cannot collide with a Better Auth cookie", () => {
    expect(SIGNUP_INTENT_COOKIE_NAME).toBe("formbricks.signup_intent");
  });
});

describe("classifySignupIntent", () => {
  test("accepts a cookie issued for the user being verified", () => {
    expect(classifySignupIntent(createSignupIntentToken("user_1"), "user_1")).toBe("valid");
  });

  // The pre-hijacking case with a stale cookie in the mix. Distinguishing this from `absent` is the
  // whole reason the reader returns a reason: `absent` is the ordinary cross-device click, while a
  // valid cookie naming a different account is the one worth looking at in the audit log.
  test("reports other_user for a valid cookie naming a different account", () => {
    expect(classifySignupIntent(createSignupIntentToken("user_1"), "user_2")).toBe("other_user");
  });

  test("reports absent when there is no cookie", () => {
    expect(classifySignupIntent(undefined, "user_1")).toBe("absent");
  });

  test("reports invalid for a cookie that does not verify", () => {
    expect(classifySignupIntent("not-a-jwt", "user_1")).toBe("invalid");
  });
});
