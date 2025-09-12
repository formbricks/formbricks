import { createCipheriv, randomBytes } from "crypto";
import { describe, expect, test, vi } from "vitest";
import { getHash, symmetricDecrypt, symmetricEncrypt } from "./crypto";

vi.mock("./constants", () => ({ ENCRYPTION_KEY: "0".repeat(32) }));

const key = "0".repeat(32);
const plain = "hello";

describe("crypto", () => {
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
});
