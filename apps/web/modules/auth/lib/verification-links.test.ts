import { describe, expect, test } from "vitest";
import { buildVerificationLinks, buildVerificationRequestedPath } from "./verification-links";

const WEBAPP_URL = "http://localhost:3000";

describe("verification link helpers", () => {
  test("builds a verification requested path with token only", () => {
    expect(buildVerificationRequestedPath({ token: "abc123" })).toBe(
      "/auth/verification-requested?token=abc123"
    );
  });

  test("builds a verification requested path that preserves callback URL", () => {
    expect(
      buildVerificationRequestedPath({
        token: "abc123",
        callbackUrl: "http://localhost:3000/invite?token=invite-token",
      })
    ).toBe(
      "/auth/verification-requested?token=abc123&callbackUrl=http%3A%2F%2Flocalhost%3A3000%2Finvite%3Ftoken%3Dinvite-token"
    );
  });

  test("builds a verification requested path that preserves SSO recovery purpose", () => {
    expect(
      buildVerificationRequestedPath({
        token: "abc123",
        callbackUrl: "http://localhost:3000/invite?token=invite-token",
        purpose: "sso_recovery",
      })
    ).toBe(
      "/auth/verification-requested?token=abc123&callbackUrl=http%3A%2F%2Flocalhost%3A3000%2Finvite%3Ftoken%3Dinvite-token&purpose=sso_recovery"
    );
  });

  // ENG-2091: the flag tells the verification-requested page the account was created but the mailer
  // failed, so it shows "we couldn't send it" instead of "check your inbox".
  test("flags a failed send, alongside the callback URL", () => {
    expect(buildVerificationRequestedPath({ token: "abc123", sendFailed: true })).toBe(
      "/auth/verification-requested?token=abc123&sendFailed=1"
    );
    expect(
      buildVerificationRequestedPath({
        token: "abc123",
        callbackUrl: "http://localhost:3000/invite?token=invite-token",
        sendFailed: true,
      })
    ).toBe(
      "/auth/verification-requested?token=abc123&callbackUrl=http%3A%2F%2Flocalhost%3A3000%2Finvite%3Ftoken%3Dinvite-token&sendFailed=1"
    );
  });

  test("omits the flag when the send succeeded, so the happy-path URL is unchanged", () => {
    // The page compares against the literal "1"; an explicit `false` must not emit the param at all.
    expect(buildVerificationRequestedPath({ token: "abc123", sendFailed: false })).toBe(
      "/auth/verification-requested?token=abc123"
    );
  });

  test("builds absolute verification links that preserve a valid callback URL", () => {
    expect(
      buildVerificationLinks({
        token: "abc123",
        webAppUrl: WEBAPP_URL,
        callbackUrl: "http://localhost:3000/environments/test?foo=bar",
      })
    ).toEqual({
      verificationRequestLink:
        "http://localhost:3000/auth/verification-requested?token=abc123&callbackUrl=http%3A%2F%2Flocalhost%3A3000%2Fenvironments%2Ftest%3Ffoo%3Dbar",
      verifyLink:
        "http://localhost:3000/api/auth/sso-recovery/sign-in?token=abc123&callbackUrl=http%3A%2F%2Flocalhost%3A3000%2Fenvironments%2Ftest%3Ffoo%3Dbar",
    });
  });

  test("drops invalid callback URLs from absolute verification links", () => {
    expect(
      buildVerificationLinks({
        token: "abc123",
        webAppUrl: WEBAPP_URL,
        callbackUrl: "https://evil.example/phish",
      })
    ).toEqual({
      verificationRequestLink: "http://localhost:3000/auth/verification-requested?token=abc123",
      verifyLink: "http://localhost:3000/api/auth/sso-recovery/sign-in?token=abc123",
    });
  });

  test("routes the SSO recovery verify link to the Better Auth sign-in endpoint", () => {
    expect(
      buildVerificationLinks({
        token: "abc123",
        webAppUrl: WEBAPP_URL,
        callbackUrl: "http://localhost:3000/environments/test?foo=bar",
        purpose: "sso_recovery",
        verificationRequestToken: "email-token",
      })
    ).toEqual({
      verificationRequestLink:
        "http://localhost:3000/auth/verification-requested?token=email-token&callbackUrl=http%3A%2F%2Flocalhost%3A3000%2Fenvironments%2Ftest%3Ffoo%3Dbar&purpose=sso_recovery",
      // The verify link always resolves at Better Auth's SSO-recovery endpoint now (email verification
      // is Better Auth-native — the legacy /auth/verify page is gone).
      verifyLink:
        "http://localhost:3000/api/auth/sso-recovery/sign-in?token=abc123&callbackUrl=http%3A%2F%2Flocalhost%3A3000%2Fenvironments%2Ftest%3Ffoo%3Dbar",
    });
  });
});
