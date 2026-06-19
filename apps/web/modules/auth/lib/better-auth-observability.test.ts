import { describe, expect, test } from "vitest";
import { getSignInAuthMethod } from "./better-auth-observability";

describe("getSignInAuthMethod (signedIn audit allow-list)", () => {
  test.each([
    ["/sign-in/email", "password"],
    ["/two-factor/verify-totp", "password"],
    ["/two-factor/verify-backup-code", "password"],
    ["/callback/google", "sso"],
    ["/oauth2/callback/azuread", "sso"],
  ])("audits sign-in completion %s as %s", (path, expected) => {
    expect(getSignInAuthMethod(path)).toBe(expected);
  });

  // Non-sign-in session re-issues must NOT be audited as signedIn (the [MEDIUM] fix).
  test.each([
    "/two-factor/disable",
    "/two-factor/enable",
    "/two-factor/verify-otp", // ambiguous — also the first-time-enable path → not a sign-in
    "/change-password",
    "/sign-in/social", // OAuth initiation, no session created
  ])("does not audit non-sign-in path %s", (path) => {
    expect(getSignInAuthMethod(path)).toBeNull();
  });

  test("does not audit when the path is undefined (context-less session create)", () => {
    expect(getSignInAuthMethod(undefined)).toBeNull();
  });
});
