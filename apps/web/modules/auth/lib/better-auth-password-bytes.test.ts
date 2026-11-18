import { APIError } from "better-auth/api";
import { describe, expect, test } from "vitest";
import { passwordByteLimitBeforeHandler } from "./better-auth-password-bytes";

const ctxFor = (path: string, body: Record<string, unknown>) => ({ path, body }) as never;

describe("passwordByteLimitBeforeHandler", () => {
  test("rejects a 73-byte newPassword on /reset-password", async () => {
    await expect(
      passwordByteLimitBeforeHandler(ctxFor("/reset-password", { newPassword: "Aa1" + "x".repeat(70) }))
    ).rejects.toBeInstanceOf(APIError);
  });

  test("counts bytes: 38 characters of 73 bytes is rejected", async () => {
    await expect(
      passwordByteLimitBeforeHandler(ctxFor("/reset-password", { newPassword: "Aa1" + "é".repeat(35) }))
    ).rejects.toBeInstanceOf(APIError);
  });

  test("accepts exactly 72 bytes", async () => {
    await expect(
      passwordByteLimitBeforeHandler(ctxFor("/reset-password", { newPassword: "Aa1" + "x".repeat(69) }))
    ).resolves.toBeUndefined();
  });

  test("does not touch sign-in, where an existing long password must reach verification", async () => {
    await expect(
      passwordByteLimitBeforeHandler(ctxFor("/sign-in/email", { password: "Aa1" + "x".repeat(100) }))
    ).resolves.toBeUndefined();
  });
});
