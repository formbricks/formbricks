import { describe, expect, test } from "vitest";
import { getResetPasswordToken } from "./reset-link";

describe("getResetPasswordToken", () => {
  test("returns the token Better Auth hands a live link", () => {
    expect(getResetPasswordToken({ token: "abc123" })).toBe("abc123");
  });

  test("returns null for the redirect Better Auth sends a dead link to", () => {
    // Expired, already used or unknown: GET /api/auth/reset-password/:token → ?error=INVALID_TOKEN
    expect(getResetPasswordToken({ error: "INVALID_TOKEN" })).toBeNull();
  });

  test("returns null when an error is present, even beside a token", () => {
    expect(getResetPasswordToken({ token: "abc123", error: "INVALID_TOKEN" })).toBeNull();
  });

  test("returns null when the page is opened without a token", () => {
    expect(getResetPasswordToken({})).toBeNull();
    expect(getResetPasswordToken({ token: "" })).toBeNull();
    expect(getResetPasswordToken({ token: "   " })).toBeNull();
  });

  test("takes the first value of a repeated token param", () => {
    expect(getResetPasswordToken({ token: ["abc123", "def456"] })).toBe("abc123");
  });
});
