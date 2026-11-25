import { compare, hash } from "bcryptjs";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
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

let legacyCbcWarned = false;

/**
 * LEGACY, decrypt-only. AES-256-CBC carries no authentication tag, so a tampered ciphertext can decrypt
 * to garbage (or leak through padding errors) instead of being refused.
 *
 * Nothing writes this format any more: `symmetricEncrypt` has produced AES-256-GCM since #5485. What can
 * still hold it is data written before that change and never rewritten (two-factor secrets and backup
 * codes, the Notion access token, cutover re-encoding). Every call site decrypts a value read from the
 * database or taken from a claim of an already-verified JWT / HMAC-checked link, never a raw
 * request value, which is what keeps the oracle out of an attacker's reach today.
 *
 * Migration plan: the first use per process logs a warning, so a deployment's logs show whether any
 * CBC payload is still being read. Once a release has gone by with no such line, re-encrypt the stored
 * values to GCM in a migration and delete this function and the two-part branch in `symmetricDecrypt`.
 */
const symmetricDecryptV1 = (text: string, key: string): string => {
  if (!legacyCbcWarned) {
    legacyCbcWarned = true;
    logger.warn("Decrypting a legacy unauthenticated AES-256-CBC payload; re-encrypt it to AES-256-GCM");
  }

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
 * via `symmetricDecryptV2`. A GCM failure is rethrown: it never falls back to the
 * unauthenticated CBC path.
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
 * Compare two secrets — MACs, signatures, token fingerprints — without leaking how far the match got.
 * `timingSafeEqual` throws on length mismatch, so the lengths are checked first; that check is not
 * itself constant-time, which is fine because the length of a fixed-width digest is not the secret.
 *
 * Use this for anything an attacker supplies and can vary between attempts. Plain `===` on a secret is
 * the bug this exists to prevent.
 */
export const constantTimeEqual = (a: string, b: string, encoding: BufferEncoding = "utf8"): boolean => {
  const aBytes = Buffer.from(a, encoding);
  const bBytes = Buffer.from(b, encoding);

  // `Buffer.from` silently drops input that is invalid for the encoding — `Buffer.from("zz", "hex")` is
  // an empty buffer — so without this guard two malformed values would compare equal at length 0.
  if (aBytes.length === 0 || bBytes.length === 0) {
    return false;
  }

  return aBytes.length === bBytes.length && timingSafeEqual(aBytes, bBytes);
};

/**
 * Constant-time check that a stored API-key lookup hash (hex SHA-256) equals the one computed from the
 * presented secret. A missing stored hash (legacy keys) never matches.
 */
export const isApiKeyLookupHashMatch = (stored: string | null | undefined, computed: string): boolean =>
  !!stored && constantTimeEqual(stored, computed, "hex");

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

// Standard Webhooks secret prefix
const WEBHOOK_SECRET_PREFIX = "whsec_";

/**
 * Generate a Standard Webhooks compliant secret
 * Following: https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md
 *
 * Format: whsec_ + base64(32 random bytes)
 * @returns A webhook secret in format "whsec_{base64_encoded_random_bytes}"
 */
export const generateWebhookSecret = (): string => {
  const secretBytes = randomBytes(32); // 256 bits of entropy
  return `${WEBHOOK_SECRET_PREFIX}${secretBytes.toString("base64")}`;
};

/**
 * Decode a Standard Webhooks secret to get the raw bytes
 * Strips the whsec_ prefix and base64 decodes the rest
 *
 * @param secret The webhook secret (with or without whsec_ prefix)
 * @returns Buffer containing the raw secret bytes
 */
export const getWebhookSecretBytes = (secret: string): Buffer => {
  const base64Part = secret.startsWith(WEBHOOK_SECRET_PREFIX)
    ? secret.slice(WEBHOOK_SECRET_PREFIX.length)
    : secret;
  return Buffer.from(base64Part, "base64");
};

/**
 * Generate Standard Webhooks compliant signature
 * Following: https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md
 *
 * @param webhookId Unique message identifier
 * @param timestamp Unix timestamp in seconds
 * @param payload The request body as a string
 * @param secret The shared secret (whsec_ prefixed)
 * @returns The signature in format "v1,{base64_signature}"
 */
export const generateStandardWebhookSignature = (
  webhookId: string,
  timestamp: number,
  payload: string,
  secret: string
): string => {
  const signedContent = `${webhookId}.${timestamp}.${payload}`;
  const secretBytes = getWebhookSecretBytes(secret);
  const signature = createHmac("sha256", secretBytes).update(signedContent).digest("base64");
  return `v1,${signature}`;
};
