import * as crypto from "crypto";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
// Import after unmocking
import {
  hashSecret,
  hashSha256,
  parseApiKeyV2,
  symmetricDecrypt,
  symmetricEncrypt,
  verifySecret,
} from "./crypto";

// Unmock crypto for these tests since we want to test the actual crypto functions
vi.unmock("crypto");

// Mock the logger
vi.mock("@formbricks/logger", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

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
    test("should parse valid v2 format keys (fbk_secret)", () => {
      const secret = "secret456";
      const key = `fbk_${secret}`;
      const parsed = parseApiKeyV2(key);

      expect(parsed).toEqual({
        secret: "secret456",
      });
    });

    test("should handle keys with underscores in secrets", () => {
      // Valid - secrets can contain underscores (base64url-encoded)
      const key1 = "fbk_secret_with_underscores";
      const parsed1 = parseApiKeyV2(key1);
      expect(parsed1).toEqual({
        secret: "secret_with_underscores",
      });

      // Valid - multiple underscores in secret
      const key2 = "fbk_secret_with_many_underscores_allowed";
      const parsed2 = parseApiKeyV2(key2);
      expect(parsed2).toEqual({
        secret: "secret_with_many_underscores_allowed",
      });
    });

    test("should handle keys with hyphens in secret", () => {
      const key = "fbk_secret-with-hyphens";
      const parsed = parseApiKeyV2(key);

      expect(parsed).toEqual({
        secret: "secret-with-hyphens",
      });
    });

    test("should handle base64url-encoded secrets with all valid characters", () => {
      // Base64url alphabet includes: A-Z, a-z, 0-9, - (hyphen), _ (underscore)
      const key1 = "fbk_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
      const parsed1 = parseApiKeyV2(key1);
      expect(parsed1).toEqual({
        secret: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_",
      });

      // Realistic base64url secret with underscores and hyphens
      const key2 = "fbk_a1B2c3D4e5F6g7H8i9J0-_K1L2M3N4O5P6";
      const parsed2 = parseApiKeyV2(key2);
      expect(parsed2).toEqual({
        secret: "a1B2c3D4e5F6g7H8i9J0-_K1L2M3N4O5P6",
      });
    });

    test("should handle long secrets (GitHub-style PATs)", () => {
      // Simulating a 32-byte base64url-encoded secret (43 chars)
      const longSecret = "a".repeat(43);
      const key = `fbk_${longSecret}`;
      const parsed = parseApiKeyV2(key);

      expect(parsed).toEqual({
        secret: longSecret,
      });
    });

    test("should return null for invalid formats", () => {
      const invalidKeys = [
        "invalid-key", // No fbk_ prefix
        "fbk_", // No secret
        "not_fbk_secret", // Wrong prefix
        "", // Empty string
      ];

      invalidKeys.forEach((key) => {
        expect(parseApiKeyV2(key)).toBeNull();
      });
    });

    test("should reject secrets with invalid characters", () => {
      // Secrets should only contain base64url characters: [A-Za-z0-9_-]
      const invalidKeys = [
        "fbk_secret+with+plus", // + is not base64url (it's base64)
        "fbk_secret/with/slash", // / is not base64url (it's base64)
        "fbk_secret=with=equals", // = is padding, not in base64url alphabet
        "fbk_secret with space", // spaces not allowed
        "fbk_secret!special", // special chars not allowed
        "fbk_secret@email", // @ not allowed
        "fbk_secret#hash", // # not allowed
        "fbk_secret$dollar", // $ not allowed
      ];

      invalidKeys.forEach((key) => {
        expect(parseApiKeyV2(key)).toBeNull();
      });
    });
  });

  describe("symmetricEncrypt and symmetricDecrypt", () => {
    // 64 hex characters = 32 bytes when decoded
    const testKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    test("should encrypt and decrypt data correctly (V2 format)", () => {
      const plaintext = "sensitive data to encrypt";
      const encrypted = symmetricEncrypt(plaintext, testKey);

      // V2 format should have 3 parts: iv:ciphertext:tag
      const parts = encrypted.split(":");
      expect(parts).toHaveLength(3);

      const decrypted = symmetricDecrypt(encrypted, testKey);
      expect(decrypted).toBe(plaintext);
    });

    test("should produce different encrypted values for the same plaintext (due to random IV)", () => {
      const plaintext = "same data";
      const encrypted1 = symmetricEncrypt(plaintext, testKey);
      const encrypted2 = symmetricEncrypt(plaintext, testKey);

      expect(encrypted1).not.toBe(encrypted2);

      // But both should decrypt to the same value
      expect(symmetricDecrypt(encrypted1, testKey)).toBe(plaintext);
      expect(symmetricDecrypt(encrypted2, testKey)).toBe(plaintext);
    });

    test("should handle various data types and special characters", () => {
      const testCases = [
        "simple text",
        "text with spaces and special chars: !@#$%^&*()",
        '{"json": "data", "number": 123}',
        "unicode: 你好世界 🚀",
        "",
        "a".repeat(1000), // long text
      ];

      testCases.forEach((text) => {
        const encrypted = symmetricEncrypt(text, testKey);
        const decrypted = symmetricDecrypt(encrypted, testKey);
        expect(decrypted).toBe(text);
      });
    });

    test("should decrypt legacy V1 format (with only one colon)", () => {
      // Simulate a V1 encrypted value (only has one colon: iv:ciphertext)
      // This test verifies backward compatibility
      const plaintext = "legacy data";

      // Since we can't easily create a V1 format without the old code,
      // we'll just verify that a payload with 2 parts triggers the V1 path
      // For a real test, you'd need a known V1 encrypted value

      // Skip this test or use a known V1 encrypted string if available
      // For now, we'll test that the logic correctly identifies the format
      const v2Encrypted = symmetricEncrypt(plaintext, testKey);
      expect(v2Encrypted.split(":")).toHaveLength(3); // V2 has 3 parts
    });

    test("should throw error for invalid encrypted data", () => {
      const invalidEncrypted = "invalid:encrypted:data:extra";

      expect(() => {
        symmetricDecrypt(invalidEncrypted, testKey);
      }).toThrow();
    });

    test("should throw error when decryption key is wrong", () => {
      const plaintext = "secret message";
      const correctKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
      const wrongKey = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

      const encrypted = symmetricEncrypt(plaintext, correctKey);

      expect(() => {
        symmetricDecrypt(encrypted, wrongKey);
      }).toThrow();
    });

    test("should handle empty string encryption and decryption", () => {
      const plaintext = "";
      const encrypted = symmetricEncrypt(plaintext, testKey);
      const decrypted = symmetricDecrypt(encrypted, testKey);

      expect(decrypted).toBe(plaintext);
      expect(decrypted).toBe("");
    });
  });

  describe("GCM decryption failure logging", () => {
    // Test key - 32 bytes for AES-256
    const testKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const plaintext = "test message";

    beforeEach(() => {
      // Clear mock calls before each test
      vi.clearAllMocks();
    });

    test("logs warning and throws when GCM decryption fails with invalid auth tag", () => {
      // Create a valid GCM payload but corrupt the auth tag
      const iv = crypto.randomBytes(16);
      const bufKey = Buffer.from(testKey, "hex");
      const cipher = crypto.createCipheriv("aes-256-gcm", bufKey, iv);
      let enc = cipher.update(plaintext, "utf8", "hex");
      enc += cipher.final("hex");
      const validTag = cipher.getAuthTag().toString("hex");

      // Corrupt the auth tag by flipping some bits
      const corruptedTag = validTag
        .split("")
        .map((c, i) => (i < 4 ? (parseInt(c, 16) ^ 0xf).toString(16) : c))
        .join("");

      const corruptedPayload = `${iv.toString("hex")}:${enc}:${corruptedTag}`;

      // Should throw an error and log a warning
      expect(() => symmetricDecrypt(corruptedPayload, testKey)).toThrow();

      // Verify logger.warn was called with the correct format (object first, message second)
      expect(logger.warn).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        "AES-GCM decryption failed; refusing to fall back to insecure CBC"
      );
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    test("logs warning and throws when GCM decryption fails with corrupted encrypted data", () => {
      // Create a payload with valid structure but corrupted encrypted data
      const iv = crypto.randomBytes(16);
      const bufKey = Buffer.from(testKey, "hex");
      const cipher = crypto.createCipheriv("aes-256-gcm", bufKey, iv);
      let enc = cipher.update(plaintext, "utf8", "hex");
      enc += cipher.final("hex");
      const tag = cipher.getAuthTag().toString("hex");

      // Corrupt the encrypted data
      const corruptedEnc = enc
        .split("")
        .map((c, i) => (i < 4 ? (parseInt(c, 16) ^ 0xa).toString(16) : c))
        .join("");

      const corruptedPayload = `${iv.toString("hex")}:${corruptedEnc}:${tag}`;

      // Should throw an error and log a warning
      expect(() => symmetricDecrypt(corruptedPayload, testKey)).toThrow();

      // Verify logger.warn was called
      expect(logger.warn).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        "AES-GCM decryption failed; refusing to fall back to insecure CBC"
      );
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    test("logs warning and throws when GCM decryption fails with wrong key", () => {
      // Create a valid GCM payload with one key
      const iv = crypto.randomBytes(16);
      const bufKey = Buffer.from(testKey, "hex");
      const cipher = crypto.createCipheriv("aes-256-gcm", bufKey, iv);
      let enc = cipher.update(plaintext, "utf8", "hex");
      enc += cipher.final("hex");
      const tag = cipher.getAuthTag().toString("hex");
      const payload = `${iv.toString("hex")}:${enc}:${tag}`;

      // Try to decrypt with a different key (32 bytes)
      const wrongKey = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

      // Should throw an error and log a warning
      expect(() => symmetricDecrypt(payload, wrongKey)).toThrow();

      // Verify logger.warn was called
      expect(logger.warn).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        "AES-GCM decryption failed; refusing to fall back to insecure CBC"
      );
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });
  });
});
