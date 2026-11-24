import { beforeEach, describe, expect, test, vi } from "vitest";
import { SIGNUP_NAME_MAX, TURNSTILE_TOKEN_MAX, ZSignupBody } from "./schemas";

const constants = vi.hoisted(() => ({ IS_TURNSTILE_CONFIGURED: true }));

vi.mock("@/lib/constants", () => ({
  get IS_TURNSTILE_CONFIGURED() {
    return constants.IS_TURNSTILE_CONFIGURED;
  },
}));

const input = { name: "Ada", email: "ada@example.com", password: "Passw0rd!" };

const turnstileIssues = (value: unknown) => {
  const result = ZSignupBody.safeParse(value);
  return result.success ? [] : result.error.issues.filter((issue) => issue.path[0] === "turnstileToken");
};

beforeEach(() => {
  constants.IS_TURNSTILE_CONFIGURED = true;
});

describe("ZSignupBody — Turnstile requirement (ENG-3988)", () => {
  // The case a field-level `.refine` let through: Zod skips it when the optional value is absent.
  test("rejects a request with no token at all when Turnstile is configured", () => {
    expect(turnstileIssues(input)).toEqual([
      expect.objectContaining({ message: "CAPTCHA verification required" }),
    ]);
  });

  test("rejects an empty token when Turnstile is configured", () => {
    expect(turnstileIssues({ ...input, turnstileToken: "" })).toHaveLength(1);
  });

  test("accepts a token when Turnstile is configured", () => {
    expect(ZSignupBody.safeParse({ ...input, turnstileToken: "token" }).success).toBe(true);
  });

  test("does not require a token when Turnstile is not configured", () => {
    constants.IS_TURNSTILE_CONFIGURED = false;

    expect(ZSignupBody.safeParse(input).success).toBe(true);
  });
});

describe("ZSignupBody — input limits", () => {
  beforeEach(() => {
    constants.IS_TURNSTILE_CONFIGURED = false;
  });

  test.each([
    ["a name", { name: "a".repeat(SIGNUP_NAME_MAX + 1) }],
    ["an invite token", { inviteToken: "t".repeat(4097) }],
    ["a Turnstile token", { turnstileToken: "t".repeat(TURNSTILE_TOKEN_MAX + 1) }],
  ])("refuses %s over its cap", (_label, overrides) => {
    expect(ZSignupBody.safeParse({ ...input, ...overrides }).success).toBe(false);
  });

  test("accepts every field at exactly its cap", () => {
    expect(
      ZSignupBody.safeParse({
        ...input,
        name: "a".repeat(SIGNUP_NAME_MAX),
        inviteToken: "t".repeat(4096),
        turnstileToken: "t".repeat(TURNSTILE_TOKEN_MAX),
      }).success
    ).toBe(true);
  });

  test("refuses an unknown field", () => {
    expect(ZSignupBody.safeParse({ ...input, role: "owner" }).success).toBe(false);
  });
});
