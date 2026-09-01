import { describe, expect, test, vi } from "vitest";
import {
  blockedSignupDomainRedirectAfterHandler,
  ssoRecoveryAfterHandler,
} from "@/modules/ee/sso/lib/better-auth-hooks";
import { runAfterAuthHooks } from "./after-auth-hooks";
import { auditFailedAuthAfter } from "./better-auth-observability";
import { twoFactorBackfillAfterHandler } from "./better-auth-two-factor-backfill";
import { verificationAutoSignInAfterHandler } from "./better-auth-verification-autosignin";

vi.mock("@/modules/ee/sso/lib/better-auth-hooks", () => ({
  ssoRecoveryAfterHandler: vi.fn(),
  blockedSignupDomainRedirectAfterHandler: vi.fn(),
}));
vi.mock("./better-auth-observability", () => ({ auditFailedAuthAfter: vi.fn() }));
vi.mock("./better-auth-two-factor-backfill", () => ({ twoFactorBackfillAfterHandler: vi.fn() }));
vi.mock("./better-auth-verification-autosignin", () => ({
  verificationAutoSignInAfterHandler: vi.fn(),
}));

describe("runAfterAuthHooks", () => {
  test("records the failed-auth audit before the personal-email redirect handler (which throws)", async () => {
    const calls: string[] = [];
    vi.mocked(ssoRecoveryAfterHandler).mockImplementation(async () => {
      calls.push("recovery");
    });
    vi.mocked(auditFailedAuthAfter).mockImplementation(async () => {
      calls.push("audit");
    });
    vi.mocked(twoFactorBackfillAfterHandler).mockImplementation(async () => {
      calls.push("two-factor-backfill");
    });
    vi.mocked(verificationAutoSignInAfterHandler).mockImplementation(async () => {
      calls.push("verification-auto-sign-in");
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
    expect(calls).toEqual([
      "recovery",
      "audit",
      "two-factor-backfill",
      "verification-auto-sign-in",
      "redirect",
    ]);
  });
});
