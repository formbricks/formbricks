import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock the (server-only) constants module so the tests are environment-independent. Getters let each
// test flip the flags at runtime — the utility reads them through live import bindings at call time.
const constantsOverrides = vi.hoisted(() => ({
  IS_FORMBRICKS_CLOUD: true,
  SIGNUP_DOMAIN_CHECK_ON_INVITES: false,
}));

vi.mock("@/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/constants")>();
  return {
    ...actual,
    get IS_FORMBRICKS_CLOUD() {
      return constantsOverrides.IS_FORMBRICKS_CLOUD;
    },
    get SIGNUP_DOMAIN_CHECK_ON_INVITES() {
      return constantsOverrides.SIGNUP_DOMAIN_CHECK_ON_INVITES;
    },
  };
});

const { isBlockedEmailDomain, isSignupEmailDomainBlocked } = await import("./signup-email-domain");

beforeEach(() => {
  constantsOverrides.IS_FORMBRICKS_CLOUD = true;
  constantsOverrides.SIGNUP_DOMAIN_CHECK_ON_INVITES = false;
});

describe("isBlockedEmailDomain", () => {
  test("returns true for known free / personal providers", () => {
    for (const email of [
      "test@gmail.com",
      "test@googlemail.com",
      "test@yahoo.com",
      "test@hotmail.com",
      "test@outlook.com",
      "test@icloud.com",
      "test@protonmail.com",
      "test@proton.me",
      "test@gmx.com",
      "test@yandex.com",
      "test@aol.com",
    ]) {
      expect(isBlockedEmailDomain(email)).toBe(true);
    }
  });

  test("returns true for known disposable / burner providers", () => {
    for (const email of [
      "test@mailinator.com",
      "test@guerrillamail.com",
      "test@yopmail.com",
      "test@10minutemail.com",
      "test@sharklasers.com",
    ]) {
      expect(isBlockedEmailDomain(email)).toBe(true);
    }
  });

  test("returns false for company domains", () => {
    for (const email of [
      "alice@acme-corp.com",
      "bob@formbricks.com",
      "carol@stripe.com",
      "dave@my-company.co.uk",
    ]) {
      expect(isBlockedEmailDomain(email)).toBe(false);
    }
  });

  test("is case- and whitespace-insensitive", () => {
    expect(isBlockedEmailDomain("Test@Gmail.Com")).toBe(true);
    expect(isBlockedEmailDomain("  TEST@YAHOO.COM  ")).toBe(true);
    expect(isBlockedEmailDomain("carol@STRIPE.com")).toBe(false);
  });

  test("matches on the domain after the last @", () => {
    // Only an exact domain match counts; a subdomain of a blocked domain is intentionally NOT blocked.
    expect(isBlockedEmailDomain("user@mail.acme-corp.com")).toBe(false);
    expect(isBlockedEmailDomain("user@sub.gmail.com")).toBe(false);
  });

  test("blocks plus-addressed and trailing-dot variants of a blocked domain", () => {
    // Plus-addressing is a common evasion attempt; the domain is unchanged so it's still blocked.
    expect(isBlockedEmailDomain("user+tag@gmail.com")).toBe(true);
    // A trailing FQDN dot is stripped so it can't slip past the Set (SSO emails aren't zod-validated).
    expect(isBlockedEmailDomain("user@gmail.com.")).toBe(true);
  });

  test("treats input with no usable domain as not-blocked", () => {
    // Missing domain or local part → not blocked. Genuinely malformed addresses (e.g. double "@")
    // are rejected by email-format validation upstream before this predicate is reached.
    for (const email of ["", "notanemail", "@gmail.com", "test@"]) {
      expect(isBlockedEmailDomain(email)).toBe(false);
    }
  });
});

describe("isSignupEmailDomainBlocked", () => {
  const noInvite = () => Promise.resolve(false);
  const validInvite = () => Promise.resolve(true);

  test("blocks a personal domain on Cloud when there is no matching invite", async () => {
    expect(await isSignupEmailDomainBlocked("user@gmail.com", noInvite)).toBe(true);
  });

  test("allows a company domain", async () => {
    expect(await isSignupEmailDomainBlocked("user@acme-corp.com", noInvite)).toBe(false);
  });

  test("exempts a valid matching invite by default", async () => {
    expect(await isSignupEmailDomainBlocked("user@gmail.com", validInvite)).toBe(false);
  });

  test("still blocks a personal-domain invite when the kill-switch is enabled", async () => {
    constantsOverrides.SIGNUP_DOMAIN_CHECK_ON_INVITES = true;
    expect(await isSignupEmailDomainBlocked("user@gmail.com", validInvite)).toBe(true);
  });

  test("never blocks when not on Formbricks Cloud", async () => {
    constantsOverrides.IS_FORMBRICKS_CLOUD = false;
    expect(await isSignupEmailDomainBlocked("user@gmail.com", noInvite)).toBe(false);
    expect(await isSignupEmailDomainBlocked("user@mailinator.com", validInvite)).toBe(false);
  });

  test("does not run the invite check when the domain is not blocked", async () => {
    const inviteCheck = vi.fn().mockResolvedValue(false);
    expect(await isSignupEmailDomainBlocked("user@acme-corp.com", inviteCheck)).toBe(false);
    expect(inviteCheck).not.toHaveBeenCalled();
  });

  test("does not run the invite check when not on Cloud", async () => {
    constantsOverrides.IS_FORMBRICKS_CLOUD = false;
    const inviteCheck = vi.fn().mockResolvedValue(true);
    expect(await isSignupEmailDomainBlocked("user@gmail.com", inviteCheck)).toBe(false);
    expect(inviteCheck).not.toHaveBeenCalled();
  });

  test("does not run the invite check when the kill-switch is enabled", async () => {
    constantsOverrides.SIGNUP_DOMAIN_CHECK_ON_INVITES = true;
    const inviteCheck = vi.fn().mockResolvedValue(true);
    expect(await isSignupEmailDomainBlocked("user@gmail.com", inviteCheck)).toBe(true);
    expect(inviteCheck).not.toHaveBeenCalled();
  });
});
