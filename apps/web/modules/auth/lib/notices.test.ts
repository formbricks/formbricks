import { describe, expect, test } from "vitest";
import { AUTH_NOTICES, EXISTING_ACCOUNT_NOTICE, parseAuthNotice } from "./notices";

describe("parseAuthNotice", () => {
  test.each(AUTH_NOTICES)("accepts the known notice %s", (notice) => {
    expect(parseAuthNotice(notice)).toBe(notice);
  });

  // The value arrives as a `?notice=` query param, so it is fully attacker-controlled. Everything
  // outside the allow-list must resolve to null rather than reaching the page — the login form maps the
  // result to a localized string and must never echo the raw param.
  test.each([
    "",
    "   ",
    "unknown_notice",
    "existing_account_invite ", // trailing space — no fuzzy matching
    "EXISTING_ACCOUNT_INVITE", // case-sensitive
    "<script>alert(1)</script>",
    "__proto__",
    "constructor",
    "toString",
  ])("rejects %p", (value) => {
    expect(parseAuthNotice(value)).toBeNull();
  });

  test("rejects an absent param", () => {
    expect(parseAuthNotice(undefined)).toBeNull();
    expect(parseAuthNotice(null)).toBeNull();
  });

  test("EXISTING_ACCOUNT_NOTICE is part of the allow-list it is matched against", () => {
    // Guards against the constant drifting away from AUTH_NOTICES, which would make the login page's
    // `notice === EXISTING_ACCOUNT_NOTICE` branch permanently unreachable (parseAuthNotice would have
    // already nulled it).
    expect(AUTH_NOTICES).toContain(EXISTING_ACCOUNT_NOTICE);
    expect(parseAuthNotice(EXISTING_ACCOUNT_NOTICE)).toBe(EXISTING_ACCOUNT_NOTICE);
  });
});
