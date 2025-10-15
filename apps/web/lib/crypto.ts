import { compare, hash } from "bcryptjs";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { logger } from "@formbricks/logger";
import { ENCRYPTION_KEY } from "@/lib/constants";

const ALGORITHM_V1 = "aes256";
const ALGORITHM_V2 = "aes-256-gcm";
const INPUT_ENCODING = "utf8";
const OUTPUT_ENCODING = "hex";
const BUFFER_ENCODING = ENCRYPTION_KEY.length === 32 ? "latin1" : "hex";
const IV_LENGTH = 16; // AES blocksize

/**
 *
 * @param text Value to be encrypted
 * @param key Key used to encrypt value must be 32 bytes for AES256 encryption algorithm
 *
 * @returns Encrypted value using key
 */
export const symmetricEncrypt = (text: string, key: string) => {
  const _key = Buffer.from(key, BUFFER_ENCODING);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM_V2, _key, iv);
  let ciphered = cipher.update(text, INPUT_ENCODING, OUTPUT_ENCODING);
  ciphered += cipher.final(OUTPUT_ENCODING);
  const tag = cipher.getAuthTag().toString(OUTPUT_ENCODING);
  return `${iv.toString(OUTPUT_ENCODING)}:${ciphered}:${tag}`;
};

/**
 *
 * @param text Value to decrypt
 * @param key Key used to decrypt value must be 32 bytes for AES256 encryption algorithm
 */

const symmetricDecryptV1 = (text: string, key: string): string => {
  const _key = Buffer.from(key, BUFFER_ENCODING);

  const components = text.split(":");
  const iv_from_ciphertext = Buffer.from(components.shift() ?? "", OUTPUT_ENCODING);
  const decipher = createDecipheriv(ALGORITHM_V1, _key, iv_from_ciphertext);
  let deciphered = decipher.update(components.join(":"), OUTPUT_ENCODING, INPUT_ENCODING);
  deciphered += decipher.final(INPUT_ENCODING);

  return deciphered;
};

/**
 *
 * @param text Value to decrypt
 * @param key Key used to decrypt value must be 32 bytes for AES256 encryption algorithm
 */

const symmetricDecryptV2 = (text: string, key: string): string => {
  // split into [ivHex, encryptedHex, tagHex]
  const [ivHex, encryptedHex, tagHex] = text.split(":");
  const _key = Buffer.from(key, BUFFER_ENCODING);
  const iv = Buffer.from(ivHex, OUTPUT_ENCODING);
  const decipher = createDecipheriv(ALGORITHM_V2, _key, iv);
  decipher.setAuthTag(Buffer.from(tagHex, OUTPUT_ENCODING));
  let decrypted = decipher.update(encryptedHex, OUTPUT_ENCODING, INPUT_ENCODING);
  decrypted += decipher.final(INPUT_ENCODING);
  return decrypted;
};

/**
 * Decrypts an encrypted payload, automatically handling multiple encryption versions.
 *
 * If the payload contains exactly one “:”, it is treated as a legacy V1 format
 * and `symmetricDecryptV1` is invoked. Otherwise, it attempts a V2 GCM decryption
 * via `symmetricDecryptV2`, falling back to V1 on failure (e.g., authentication
 * errors or bad formats).
 *
 * @param payload - The encrypted string to decrypt.
 * @param key - The secret key used for decryption.
 * @returns The decrypted plaintext.
 */

export function symmetricDecrypt(payload: string, key: string): string {
  // If it's clearly V1 (only one “:”), skip straight to V1
  if (payload.split(":").length === 2) {
    return symmetricDecryptV1(payload, key);
  }

  // Otherwise try GCM first, then fall back to CBC
  try {
    return symmetricDecryptV2(payload, key);
  } catch (err) {
    logger.warn({ err }, "AES-GCM decryption failed; refusing to fall back to insecure CBC");

    throw err;
  }
}

/**
 * General bcrypt hashing utility for secrets (passwords, API keys, etc.)
 */
export const hashSecret = async (secret: string, cost: number = 12): Promise<string> => {
  return await hash(secret, cost);
};

/**
 * General bcrypt verification utility for secrets (passwords, API keys, etc.)
 */
export const verifySecret = async (secret: string, hashedSecret: string): Promise<boolean> => {
  try {
    const isValid = await compare(secret, hashedSecret);
    return isValid;
  } catch (error) {
    // Log warning for debugging purposes, but don't throw to maintain security
    logger.warn({ error }, "Secret verification failed due to invalid hash format");
    // Return false for invalid hashes or other bcrypt errors
    return false;
  }
};

/**
 * SHA-256 hashing utility (deterministic, for legacy support)
 */
export const hashSha256 = (input: string): string => {
  return createHash("sha256").update(input).digest("hex");
};

/**
 * Parse a v2 API key format: fbk_{secret}
 * Returns null if the key doesn't match the expected format
 */
export const parseApiKeyV2 = (key: string): { secret: string } | null => {
  // Check if it starts with fbk_
  if (!key.startsWith("fbk_")) {
    return null;
  }

  const secret = key.slice(4); // Skip 'fbk_' prefix

  // Validate that secret contains only allowed characters and is not empty
  // Secrets are base64url-encoded and can contain underscores, hyphens, and alphanumeric chars
  if (!secret || !/^[A-Za-z0-9_-]+$/.test(secret)) {
    return null;
  }

  return { secret };
};
