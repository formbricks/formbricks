import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "crypto";
import { logger } from "@formbricks/logger";
import { ENCRYPTION_KEY } from "./constants";

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
    logger.warn("AES-GCM decryption failed; refusing to fall back to insecure CBC", err);

    throw err;
  }
}

export const getHash = (key: string): string => createHash("sha256").update(key).digest("hex");

export const generateLocalSignedUrl = (
  fileName: string,
  environmentId: string,
  fileType: string
): { signature: string; uuid: string; timestamp: number } => {
  const uuid = randomBytes(16).toString("hex");
  const timestamp = Date.now();
  const data = `${uuid}:${fileName}:${environmentId}:${fileType}:${timestamp}`;
  const signature = createHmac("sha256", ENCRYPTION_KEY).update(data).digest("hex");
  return { signature, uuid, timestamp };
};

export const validateLocalSignedUrl = (
  uuid: string,
  fileName: string,
  environmentId: string,
  fileType: string,
  timestamp: number,
  signature: string,
  secret: string
): boolean => {
  const data = `${uuid}:${fileName}:${environmentId}:${fileType}:${timestamp}`;
  const expectedSignature = createHmac("sha256", secret).update(data).digest("hex");

  if (expectedSignature !== signature) {
    return false;
  }

  // valid for 5 minutes
  if (Date.now() - timestamp > 1000 * 60 * 5) {
    return false;
  }

  return true;
};
