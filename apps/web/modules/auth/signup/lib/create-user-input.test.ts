import { beforeEach, describe, expect, test, vi } from "vitest";
import { ZCreateUserAction } from "./create-user-input";

const constants = vi.hoisted(() => ({ IS_TURNSTILE_CONFIGURED: true }));

vi.mock("@/lib/constants", () => ({
  get IS_TURNSTILE_CONFIGURED() {
    return constants.IS_TURNSTILE_CONFIGURED;
  },
}));

const input = { name: "Ada", email: "ada@example.com", password: "Passw0rd!" };

const turnstileIssues = (value: unknown) => {
  const result = ZCreateUserAction.safeParse(value);
  return result.success ? [] : result.error.issues.filter((issue) => issue.path[0] === "turnstileToken");
};

beforeEach(() => {
  constants.IS_TURNSTILE_CONFIGURED = true;
});

describe("ZCreateUserAction — Turnstile requirement (ENG-3988)", () => {
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
    expect(ZCreateUserAction.safeParse({ ...input, turnstileToken: "token" }).success).toBe(true);
  });

  test("does not require a token when Turnstile is not configured", () => {
    constants.IS_TURNSTILE_CONFIGURED = false;

    expect(ZCreateUserAction.safeParse(input).success).toBe(true);
  });
});
