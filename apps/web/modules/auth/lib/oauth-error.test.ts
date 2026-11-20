import { describe, expect, test } from "vitest";
import {
  SSO_RECOVERY_LINK_NOT_OPENED_ERROR_CODE,
  SSO_RECOVERY_SECOND_FACTOR_UNAVAILABLE_ERROR_CODE,
} from "@formbricks/types/errors";
import { getOAuthErrorVariant } from "./oauth-error";
import { SSO_PROVISIONING_REJECT_REASONS } from "./sso-provisioning-reject-reasons";

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

  /**
   * ENG-2882. `generic` tells the user to try again, which is actively wrong advice for a reject:
   * the gate's decision is deterministic, so a retry reproduces it exactly. The Record in oauth-error
   * makes an unclassified reason a build error; this asserts the runtime consequence of that, and
   * catches a reason classified by a key that no longer matches the gate's spelling.
   */
  test.each(SSO_PROVISIONING_REJECT_REASONS)(
    "never falls back to a retry prompt for the reject reason %s",
    (reason) => {
      expect(getOAuthErrorVariant(reason)).not.toBe("generic");
    }
  );

  /**
   * ENG-7266. A verified 2FA account on an instance with credential sign-in off has no way to produce
   * the factor on the login page, and the identity that started recovery is unlinked by definition —
   * so this must not fall through to `generic` ("try again"), which cannot ever work.
   */
  test("names the unmeetable second factor rather than inviting a retry", () => {
    expect(getOAuthErrorVariant(SSO_RECOVERY_SECOND_FACTOR_UNAVAILABLE_ERROR_CODE)).toBe(
      "second_factor_unavailable"
    );
  });

  /** ENG-7310. Retrying cannot help here; opening the emailed link in this browser can. */
  test("names the unopened recovery link rather than inviting a retry", () => {
    expect(getOAuthErrorVariant(SSO_RECOVERY_LINK_NOT_OPENED_ERROR_CODE)).toBe("recovery_link_not_opened");
  });
});
