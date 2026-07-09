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
    // Load-bearing: the audit must run before the redirect throw, or a personal-email SSO rejection
    // would skip the failed-auth audit entirely.
    expect(calls).toEqual(["recovery", "audit", "redirect"]);
  });
});
