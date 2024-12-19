import crypto from "crypto";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "crypto";
import { ENCRYPTION_KEY } from "./constants";

const ALGORITHM = "aes256";
const INPUT_ENCODING = "utf8";
const OUTPUT_ENCODING = "hex";
const BUFFER_ENCODING = ENCRYPTION_KEY!.length === 32 ? "latin1" : "hex";
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
  const iv = crypto.randomBytes(IV_LENGTH);

  // @ts-ignore -- the package needs to be built
  const cipher = crypto.createCipheriv(ALGORITHM, _key, iv);
  let ciphered = cipher.update(text, INPUT_ENCODING, OUTPUT_ENCODING);
  ciphered += cipher.final(OUTPUT_ENCODING);
  const ciphertext = iv.toString(OUTPUT_ENCODING) + ":" + ciphered;

  return ciphertext;
};

/**
 *
 * @param text Value to decrypt
 * @param key Key used to decrypt value must be 32 bytes for AES256 encryption algorithm
 */
export const symmetricDecrypt = (text: string, key: string) => {
  const _key = Buffer.from(key, BUFFER_ENCODING);

  const components = text.split(":");
  const iv_from_ciphertext = Buffer.from(components.shift() || "", OUTPUT_ENCODING);
  // @ts-ignore -- the package needs to be built
  const decipher = crypto.createDecipheriv(ALGORITHM, _key, iv_from_ciphertext);
  let deciphered = decipher.update(components.join(":"), OUTPUT_ENCODING, INPUT_ENCODING);
  deciphered += decipher.final(INPUT_ENCODING);

  return deciphered;
};

export const getHash = (key: string): string => createHash("sha256").update(key).digest("hex");

// create an aes128 encryption function
export const encryptAES128 = (encryptionKey: string, data: string): string => {
  // @ts-ignore -- the package needs to be built
  const cipher = createCipheriv("aes-128-ecb", Buffer.from(encryptionKey, "base64"), "");
  let encrypted = cipher.update(data, "utf-8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
};
// create an aes128 decryption function
export const decryptAES128 = (encryptionKey: string, data: string): string => {
  // @ts-ignore -- the package needs to be built
  const cipher = createDecipheriv("aes-128-ecb", Buffer.from(encryptionKey, "base64"), "");
  let decrypted = cipher.update(data, "hex", "utf-8");
  decrypted += cipher.final("utf-8");
  return decrypted;
};

export const generateLocalSignedUrl = (
  fileName: string,
  environmentId: string,
  fileType: string
): { signature: string; uuid: string; timestamp: number } => {
  const uuid = randomBytes(16).toString("hex");
  const timestamp = Date.now();
  const data = `${uuid}:${fileName}:${environmentId}:${fileType}:${timestamp}`;
  const signature = createHmac("sha256", ENCRYPTION_KEY!).update(data).digest("hex");
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
