import { describe, expect, test } from "vitest";
import { captureSsoIdentity, getPendingSsoIdentity, runWithSsoRequestContext } from "./sso-request-context";

describe("captureSsoIdentity", () => {
  test("stashes a complete identity for verify-before-link recovery", () => {
    const stashed = runWithSsoRequestContext(() => {
      captureSsoIdentity({ email: "user@example.com", providerAccountId: "acc-1" });
      return getPendingSsoIdentity();
    });
    expect(stashed).toEqual({ email: "user@example.com", providerAccountId: "acc-1" });
  });

  test("drops an identity missing the email so recovery falls through to the default error", () => {
    const stashed = runWithSsoRequestContext(() => {
      captureSsoIdentity({ email: null, providerAccountId: "acc-1" });
      return getPendingSsoIdentity();
    });
    expect(stashed).toBeUndefined();
  });

  test("drops an identity missing the providerAccountId", () => {
    const stashed = runWithSsoRequestContext(() => {
      captureSsoIdentity({ email: "user@example.com", providerAccountId: null });
      return getPendingSsoIdentity();
    });
    expect(stashed).toBeUndefined();
  });

  test("no-ops (does not throw) when called outside a request context", () => {
    expect(() => captureSsoIdentity({ email: "user@example.com", providerAccountId: "acc-1" })).not.toThrow();
    expect(getPendingSsoIdentity()).toBeUndefined();
  });
});
