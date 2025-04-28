import { describe, expect, test } from "vitest";
import { hashPassword, verifyPassword } from "./utils";

describe("Password Utils", () => {
  const password = "password";
  const hashedPassword = "$2a$12$LZsLq.9nkZlU0YDPx2aLNelnwD/nyavqbewLN.5.Q5h/UxRD8Ymcy";

  describe("hashPassword", () => {
    test("should hash a password", async () => {
      const hashedPassword = await hashPassword(password);

      expect(typeof hashedPassword).toBe("string");
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword.length).toBe(60);
    });

    test("should generate different hashes for the same password", async () => {
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("verifyPassword", () => {
    test("should verify a correct password", async () => {
      const isValid = await verifyPassword(password, hashedPassword);

      expect(isValid).toBe(true);
    });

    test("should reject an incorrect password", async () => {
      const isValid = await verifyPassword("WrongPassword123!", hashedPassword);

      expect(isValid).toBe(false);
    });
  });
});
