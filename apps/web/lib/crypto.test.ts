import { describe, expect, test, vi } from "vitest";
// Import after unmocking
import { hashSecret, hashSha256, parseApiKeyV2, verifySecret } from "./crypto";

// Unmock crypto for these tests since we want to test the actual crypto functions
vi.unmock("crypto");

describe("Crypto Utils", () => {
  describe("hashSecret and verifySecret", () => {
    test("should hash and verify secrets correctly", async () => {
      const secret = "test-secret-123";
      const hash = await hashSecret(secret);

      expect(hash).toMatch(/^\$2[aby]\$\d+\$[./A-Za-z0-9]{53}$/);

      const isValid = await verifySecret(secret, hash);
      expect(isValid).toBe(true);
    });

    test("should reject wrong secrets", async () => {
      const secret = "test-secret-123";
      const wrongSecret = "wrong-secret";
      const hash = await hashSecret(secret);

      const isValid = await verifySecret(wrongSecret, hash);
      expect(isValid).toBe(false);
    });

    test("should generate different hashes for the same secret (due to salt)", async () => {
      const secret = "test-secret-123";
      const hash1 = await hashSecret(secret);
      const hash2 = await hashSecret(secret);

      expect(hash1).not.toBe(hash2);

      // But both should verify correctly
      expect(await verifySecret(secret, hash1)).toBe(true);
      expect(await verifySecret(secret, hash2)).toBe(true);
    });

    test("should use custom cost factor", async () => {
      const secret = "test-secret-123";
      const hash = await hashSecret(secret, 10);

      // Verify the cost factor is in the hash
      expect(hash).toMatch(/^\$2[aby]\$10\$/);
      expect(await verifySecret(secret, hash)).toBe(true);
    });

    test("should return false for invalid hash format", async () => {
      const secret = "test-secret-123";
      const invalidHash = "not-a-bcrypt-hash";

      const isValid = await verifySecret(secret, invalidHash);
      expect(isValid).toBe(false);
    });
  });

  describe("hashSha256", () => {
    test("should generate deterministic SHA-256 hashes", () => {
      const input = "test-input-123";
      const hash1 = hashSha256(input);
      const hash2 = hashSha256(input);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    test("should generate different hashes for different inputs", () => {
      const hash1 = hashSha256("input1");
      const hash2 = hashSha256("input2");

      expect(hash1).not.toBe(hash2);
    });

    test("should generate correct SHA-256 hash", () => {
      // Known SHA-256 hash for "hello"
      const input = "hello";
      const expectedHash = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

      expect(hashSha256(input)).toBe(expectedHash);
    });
  });

  describe("parseApiKeyV2", () => {
    test("should parse valid v2 format keys", () => {
      const key = "fbk_cuid123_secret456";
      const parsed = parseApiKeyV2(key);

      expect(parsed).toEqual({
        id: "cuid123",
        secret: "secret456",
      });
    });

    test("should handle keys with exactly 2 underscores", () => {
      // Valid key with exactly 2 underscores
      const key1 = "fbk_simple-id_simple-secret";
      const parsed1 = parseApiKeyV2(key1);
      expect(parsed1).toEqual({
        id: "simple-id",
        secret: "simple-secret",
      });

      // Invalid - too many underscores (4 total)
      const key2 = "fbk_id_with_underscores_secret";
      const parsed2 = parseApiKeyV2(key2);
      expect(parsed2).toBeNull();

      // Invalid - too many underscores (6 total)
      const key3 = "fbk_id_with_underscores_secret_with_underscores";
      const parsed3 = parseApiKeyV2(key3);
      expect(parsed3).toBeNull();
    });

    test("should handle keys with hyphens in id and secret", () => {
      const key = "fbk_id-with-hyphens_secret-with-hyphens";
      const parsed = parseApiKeyV2(key);

      expect(parsed).toEqual({
        id: "id-with-hyphens",
        secret: "secret-with-hyphens",
      });
    });

    test("should return null for invalid formats", () => {
      const invalidKeys = [
        "invalid-key",
        "fbk_",
        "fbk_id",
        "fbk_id_",
        "not_fbk_id_secret",
        "fbk__id_secret",
        "fbk_id__secret",
        "",
        "fbk_id_secret_extra",
      ];

      invalidKeys.forEach((key) => {
        expect(parseApiKeyV2(key)).toBeNull();
      });
    });
  });
});
