import { describe, expect, test, vi } from "vitest";
import {
  blockedSignupDomainRedirectAfterHandler,
  ssoRecoveryAfterHandler,
} from "@/modules/ee/sso/lib/better-auth-hooks";
import { runAfterAuthHooks } from "./after-auth-hooks";
import { auditFailedAuthAfter } from "./better-auth-observability";

vi.mock("@/modules/ee/sso/lib/better-auth-hooks", () => ({
  ssoRecoveryAfterHandler: vi.fn(),
  blockedSignupDomainRedirectAfterHandler: vi.fn(),
}));
vi.mock("./better-auth-observability", () => ({ auditFailedAuthAfter: vi.fn() }));

describe("runAfterAuthHooks", () => {
  test("records the failed-auth audit before the personal-email redirect handler (which throws)", async () => {
    const calls: string[] = [];
    vi.mocked(ssoRecoveryAfterHandler).mockImplementation(async () => {
      calls.push("recovery");
    });
    vi.mocked(auditFailedAuthAfter).mockImplementation(async () => {
      calls.push("audit");
    });
    vi.mocked(blockedSignupDomainRedirectAfterHandler).mockImplementation(async () => {
      calls.push("redirect");
      throw new Error("ctx.redirect"); // mirrors the real handler's ctx.redirect throw
    });

    await expect(runAfterAuthHooks({} as never)).rejects.toThrow();
    // Pins the intended order: the audit runs before the redirect throw. Future-proofing today
    // (auditFailedAuthAfter only records /sign-in/email, so an SSO /callback rejection no-ops it either
    // way), but locks the contract for when the failed-auth audit is extended to SSO callback paths.
    expect(calls).toEqual(["recovery", "audit", "redirect"]);
  });
});
