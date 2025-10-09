import { createCipheriv, randomBytes } from "crypto";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { getHash, symmetricDecrypt, symmetricEncrypt } from "./crypto";

vi.mock("./constants", () => ({ ENCRYPTION_KEY: "0".repeat(32) }));

vi.mock("@formbricks/logger", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

const key = "0".repeat(32);
const plain = "hello";

describe("crypto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("encrypt + decrypt roundtrip", () => {
    const cipher = symmetricEncrypt(plain, key);
    expect(symmetricDecrypt(cipher, key)).toBe(plain);
  });

  test("decrypt V2 GCM payload", () => {
    const iv = randomBytes(16);
    const bufKey = Buffer.from(key, "utf8");
    const cipher = createCipheriv("aes-256-gcm", bufKey, iv);
    let enc = cipher.update(plain, "utf8", "hex");
    enc += cipher.final("hex");
    const tag = cipher.getAuthTag().toString("hex");
    const payload = `${iv.toString("hex")}:${enc}:${tag}`;
    expect(symmetricDecrypt(payload, key)).toBe(plain);
  });

  test("decrypt legacy (single-colon) payload", () => {
    const iv = randomBytes(16);
    const cipher = createCipheriv("aes256", Buffer.from(key, "utf8"), iv); // NOSONAR typescript:S5542 // We are testing backwards compatibility
    let enc = cipher.update(plain, "utf8", "hex");
    enc += cipher.final("hex");
    const legacy = `${iv.toString("hex")}:${enc}`;
    expect(symmetricDecrypt(legacy, key)).toBe(plain);
  });

  test("getHash returns a non-empty string", () => {
    const h = getHash("abc");
    expect(typeof h).toBe("string");
    expect(h.length).toBeGreaterThan(0);
  });

  test("logs warning and throws when GCM decryption fails with invalid auth tag", () => {
    // Create a valid GCM payload but corrupt the auth tag
    const iv = randomBytes(16);
    const bufKey = Buffer.from(key, "utf8");
    const cipher = createCipheriv("aes-256-gcm", bufKey, iv);
    let enc = cipher.update(plain, "utf8", "hex");
    enc += cipher.final("hex");
    const validTag = cipher.getAuthTag().toString("hex");

    // Corrupt the auth tag by flipping some bits
    const corruptedTag = validTag
      .split("")
      .map((c, i) => (i < 4 ? (parseInt(c, 16) ^ 0xf).toString(16) : c))
      .join("");

    const corruptedPayload = `${iv.toString("hex")}:${enc}:${corruptedTag}`;

    // Should throw an error and log a warning
    expect(() => symmetricDecrypt(corruptedPayload, key)).toThrow();

    // Verify logger.warn was called with the correct format (object first, message second)
    expect(logger.warn).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      "AES-GCM decryption failed; refusing to fall back to insecure CBC"
    );
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  test("logs warning and throws when GCM decryption fails with corrupted encrypted data", () => {
    // Create a payload with valid structure but corrupted encrypted data
    const iv = randomBytes(16);
    const bufKey = Buffer.from(key, "utf8");
    const cipher = createCipheriv("aes-256-gcm", bufKey, iv);
    let enc = cipher.update(plain, "utf8", "hex");
    enc += cipher.final("hex");
    const tag = cipher.getAuthTag().toString("hex");

    // Corrupt the encrypted data
    const corruptedEnc = enc
      .split("")
      .map((c, i) => (i < 4 ? (parseInt(c, 16) ^ 0xa).toString(16) : c))
      .join("");

    const corruptedPayload = `${iv.toString("hex")}:${corruptedEnc}:${tag}`;

    // Should throw an error and log a warning
    expect(() => symmetricDecrypt(corruptedPayload, key)).toThrow();

    // Verify logger.warn was called
    expect(logger.warn).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      "AES-GCM decryption failed; refusing to fall back to insecure CBC"
    );
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  test("logs warning and throws when GCM decryption fails with wrong key", () => {
    // Create a valid GCM payload with one key
    const iv = randomBytes(16);
    const bufKey = Buffer.from(key, "utf8");
    const cipher = createCipheriv("aes-256-gcm", bufKey, iv);
    let enc = cipher.update(plain, "utf8", "hex");
    enc += cipher.final("hex");
    const tag = cipher.getAuthTag().toString("hex");
    const payload = `${iv.toString("hex")}:${enc}:${tag}`;

    // Try to decrypt with a different key
    const wrongKey = "1".repeat(32);

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
