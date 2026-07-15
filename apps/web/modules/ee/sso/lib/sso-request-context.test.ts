import { describe, expect, test } from "vitest";
import {
  captureSsoIdentity,
  getPendingSsoIdentity,
  getSsoAttributionProperties,
  getSsoSignupRejectReason,
  runWithSsoRequestContext,
  setSsoAttributionProperties,
  setSsoSignupRejectReason,
} from "./sso-request-context";

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

describe("SSO attribution properties", () => {
  test("stashes attribution for the user.create.after hook to read back", () => {
    const stashed = runWithSsoRequestContext(() => {
      setSsoAttributionProperties({ utm_source: "twitter", entry_page: "/pricing" });
      return getSsoAttributionProperties();
    });
    expect(stashed).toEqual({ utm_source: "twitter", entry_page: "/pricing" });
  });

  test("defaults to an empty object when none was stashed", () => {
    expect(runWithSsoRequestContext(() => getSsoAttributionProperties())).toEqual({});
  });

  test("no-ops (does not throw) and returns {} outside a request context", () => {
    expect(() => setSsoAttributionProperties({ utm_source: "x" })).not.toThrow();
    expect(getSsoAttributionProperties()).toEqual({});
  });
});

describe("SSO signup reject reason", () => {
  test("stashes the reject reason for the redirect after-hook to read back", () => {
    const stashed = runWithSsoRequestContext(() => {
      setSsoSignupRejectReason("email_domain_not_allowed");
      return getSsoSignupRejectReason();
    });
    expect(stashed).toBe("email_domain_not_allowed");
  });

  test("is undefined when none was stashed", () => {
    expect(runWithSsoRequestContext(() => getSsoSignupRejectReason())).toBeUndefined();
  });

  test("no-ops (does not throw) and returns undefined outside a request context", () => {
    expect(() => setSsoSignupRejectReason("email_domain_not_allowed")).not.toThrow();
    expect(getSsoSignupRejectReason()).toBeUndefined();
  });
});
