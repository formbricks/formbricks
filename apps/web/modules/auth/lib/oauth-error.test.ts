import { describe, expect, test } from "vitest";
import { getOAuthErrorVariant } from "./oauth-error";

describe("getOAuthErrorVariant", () => {
  test("returns null when the callback carried no error", () => {
    expect(getOAuthErrorVariant(undefined)).toBeNull();
    expect(getOAuthErrorVariant(null)).toBeNull();
    expect(getOAuthErrorVariant("")).toBeNull();
  });

  test.each(["account_not_linked", "OAuthAccountNotLinked"])(
    "keeps the existing not-linked alert for %s",
    (code) => {
      expect(getOAuthErrorVariant(code)).toBe("account_not_linked");
    }
  );

  test.each([
    // What Better Auth redirects with when gateSsoProvisioning throws — the code from the ENG-2089
    // report, which previously rendered an untouched login form.
    "unable_to_create_user",
    "user_creation_failed",
    // gateSsoProvisioning's own invite-related reject reasons.
    "missing_callback_url",
    "signin_without_invite_token",
    "invalid_invite_token",
    "invite_email_mismatch",
    "invite_token_validation_error",
  ])("tells the user to ask for an invite for %s", (code) => {
    expect(getOAuthErrorVariant(code)).toBe("signup_not_allowed");
  });

  test.each([
    "missing_default_team_id",
    "no_organization_found",
    "insufficient_role_permissions",
    "oauth_provider_not_found",
    "invalid_scope",
  ])("points at the instance configuration for %s", (code) => {
    expect(getOAuthErrorVariant(code)).toBe("misconfigured");
  });

  test.each([
    // Better Auth's transient callback failures.
    "state_mismatch",
    "invalid_code",
    "internal_server_error",
    // A code that no longer exists upstream (from the original report), and one that never did: both
    // must still say something. Silence is the bug this closes.
    "oauth_code_verification_failed",
    "a_code_no_version_of_better_auth_has_ever_emitted",
  ])("falls back to the generic alert for %s", (code) => {
    expect(getOAuthErrorVariant(code)).toBe("generic");
  });
});
