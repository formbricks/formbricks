import { APIError } from "better-auth/api";
import { describe, expect, test } from "vitest";
import { passwordByteLimitBeforeHandler } from "./better-auth-password-bytes";

const ctxFor = (path: string, body: Record<string, unknown>) => ({ path, body }) as never;

describe("passwordByteLimitBeforeHandler", () => {
  test("rejects a 73-byte newPassword on /reset-password", () => {
    expect(() =>
      passwordByteLimitBeforeHandler(ctxFor("/reset-password", { newPassword: "Aa1" + "x".repeat(70) }))
    ).toThrow(APIError);
  });

  test("counts bytes: 38 characters of 73 bytes is rejected", () => {
    expect(() =>
      passwordByteLimitBeforeHandler(ctxFor("/reset-password", { newPassword: "Aa1" + "é".repeat(35) }))
    ).toThrow(APIError);
  });

  test("accepts exactly 72 bytes", () => {
    expect(
      passwordByteLimitBeforeHandler(ctxFor("/reset-password", { newPassword: "Aa1" + "x".repeat(69) }))
    ).toBeUndefined();
  });

  test("does not touch sign-in, where an existing long password must reach verification", () => {
    expect(
      passwordByteLimitBeforeHandler(ctxFor("/sign-in/email", { password: "Aa1" + "x".repeat(100) }))
    ).toBeUndefined();
  });
});
