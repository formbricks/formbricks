import { createHash, createCipheriv, createDecipheriv } from "crypto";

export const getHash = (key: string): string => createHash("sha256").update(key).digest("hex");

// create an aes128 encryption function
export const encryptAES128 = (encryptionKey: string, data: string): string => {
  const cipher = createCipheriv("aes-128-ecb", Buffer.from(encryptionKey, "base64"), "");
  let encrypted = cipher.update(data, "utf-8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
};
// create an aes128 decryption function
export const decryptAES128 = (encryptionKey: string, data: string): string => {
  const cipher = createDecipheriv("aes-128-ecb", Buffer.from(encryptionKey, "base64"), "");
  let decrypted = cipher.update(data, "hex", "utf-8");
  decrypted += cipher.final("utf-8");
  return decrypted;
};
