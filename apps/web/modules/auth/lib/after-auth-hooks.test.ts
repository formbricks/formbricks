import { describe, expect, test, vi } from "vitest";
import {
  blockedSignupDomainRedirectAfterHandler,
  ssoRecoveryAfterHandler,
} from "@/modules/ee/sso/lib/better-auth-hooks";
import { runAfterAuthHooks } from "./after-auth-hooks";
import { auditFailedAuthAfter } from "./better-auth-observability";
import { settleSignInBudgetAfterHandler } from "./better-auth-sign-in-budget";
import { twoFactorBackfillAfterHandler } from "./better-auth-two-factor-backfill";
import { maskUnverifiedSignInAfterHandler } from "./better-auth-unverified-sign-in";
import { verificationAutoSignInAfterHandler } from "./better-auth-verification-autosignin";
import { revokeTokensBeyondConsentAfterHandler } from "./oauth-grant-revocation";
import { requireOAuthConsentOnRefreshAfterHandler } from "./oauth-refresh-check";

vi.mock("@/modules/ee/sso/lib/better-auth-hooks", () => ({
  ssoRecoveryAfterHandler: vi.fn(),
  blockedSignupDomainRedirectAfterHandler: vi.fn(),
}));
vi.mock("./better-auth-observability", () => ({ auditFailedAuthAfter: vi.fn() }));
vi.mock("./better-auth-sign-in-budget", () => ({ settleSignInBudgetAfterHandler: vi.fn() }));
vi.mock("./better-auth-two-factor-backfill", () => ({ twoFactorBackfillAfterHandler: vi.fn() }));
vi.mock("./better-auth-unverified-sign-in", () => ({ maskUnverifiedSignInAfterHandler: vi.fn() }));
vi.mock("./better-auth-verification-autosignin", () => ({
  verificationAutoSignInAfterHandler: vi.fn(),
}));
vi.mock("./oauth-grant-revocation", () => ({ revokeTokensBeyondConsentAfterHandler: vi.fn() }));
vi.mock("./oauth-refresh-check", () => ({ requireOAuthConsentOnRefreshAfterHandler: vi.fn() }));

describe("runAfterAuthHooks", () => {
  test("records the failed-auth audit before the personal-email redirect handler (which throws)", async () => {
    const calls: string[] = [];
    vi.mocked(ssoRecoveryAfterHandler).mockImplementation(async () => {
      calls.push("recovery");
    });
    vi.mocked(auditFailedAuthAfter).mockImplementation(async () => {
      calls.push("audit");
    });
    vi.mocked(settleSignInBudgetAfterHandler).mockImplementation(async () => {
      calls.push("sign-in-budget");
    });
    vi.mocked(twoFactorBackfillAfterHandler).mockImplementation(async () => {
      calls.push("two-factor-backfill");
    });
    vi.mocked(verificationAutoSignInAfterHandler).mockImplementation(async () => {
      calls.push("verification-auto-sign-in");
    });
    vi.mocked(requireOAuthConsentOnRefreshAfterHandler).mockImplementation(async () => {
      calls.push("oauth-refresh-consent");
    });
    vi.mocked(revokeTokensBeyondConsentAfterHandler).mockImplementation(async () => {
      calls.push("oauth-consent-narrowed");
    });
    vi.mocked(blockedSignupDomainRedirectAfterHandler).mockImplementation(async () => {
      calls.push("redirect");
      throw new Error("ctx.redirect"); // mirrors the real handler's ctx.redirect throw
    });

    await expect(runAfterAuthHooks({} as never)).rejects.toThrow();
    // Pins the intended order: the audit runs before the redirect throw. Future-proofing today
    // (auditFailedAuthAfter only records /sign-in/email, so an SSO /callback rejection no-ops it either
    // way), but locks the contract for when the failed-auth audit is extended to SSO callback paths.
    //
    // The ENG-2562 auto-sign-in also has to sit ahead of that throw: it is the only handler here that
    // GRANTS something, and a redirect thrown before it would silently cost a legitimate same-browser
    // sign-up its session on any request that hit both.
    //
    // The ENG-2499 / ENG-3529 OAuth handlers only touch /oauth2/token, /oauth2/consent and
    // /oauth2/update-consent, so their place relative to the SSO handlers is not load-bearing; it is
    // pinned so a reorder is a deliberate edit.
    expect(calls).toEqual([
      "recovery",
      "audit",
      "sign-in-budget",
      "two-factor-backfill",
      "verification-auto-sign-in",
      "oauth-refresh-consent",
      "oauth-consent-narrowed",
      "redirect",
    ]);
  });

  // ENG-2099: the unverified-sign-in rewrite replaces the response, so the failed-sign-in audit (which
  // records the real `email_not_verified` reason) and the sign-in budget (which spends the unit for it)
  // have to read the request's own error first. Its response is what the chain returns.
  test("rewrites an unverified sign-in last, after the audit and the budget have read the real code", async () => {
    vi.clearAllMocks();
    const calls: string[] = [];
    vi.mocked(auditFailedAuthAfter).mockImplementation(async () => {
      calls.push("audit");
    });
    vi.mocked(settleSignInBudgetAfterHandler).mockImplementation(async () => {
      calls.push("sign-in-budget");
    });
    vi.mocked(blockedSignupDomainRedirectAfterHandler).mockImplementation(async () => {
      calls.push("redirect");
    });
    const rewritten = new Response(null, { status: 401 });
    vi.mocked(maskUnverifiedSignInAfterHandler).mockImplementation(() => {
      calls.push("mask-unverified");
      return rewritten;
    });

    await expect(runAfterAuthHooks({} as never)).resolves.toBe(rewritten);
    expect(calls).toEqual(["audit", "sign-in-budget", "redirect", "mask-unverified"]);
  });
});
