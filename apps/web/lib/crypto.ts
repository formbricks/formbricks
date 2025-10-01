import { compare, hash } from "bcryptjs";
import { createHash } from "crypto";
import { logger } from "@formbricks/logger";

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
    logger.warn("Secret verification failed due to invalid hash format", { error });
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
 * Parse a v2 API key format: fbk_{id}_{secret}
 * Returns null if the key doesn't match the expected format
 */
export const parseApiKeyV2 = (key: string): { id: string; secret: string } | null => {
  // Check if it starts with fbk_
  if (!key.startsWith("fbk_")) {
    return null;
  }

  // Count total underscores - should be exactly 2 (fbk_id_secret)
  const underscoreCount = (key.match(/_/g) || []).length;
  if (underscoreCount !== 2) {
    return null;
  }

  // Find the last underscore to separate id and secret
  const lastUnderscoreIndex = key.lastIndexOf("_");
  if (lastUnderscoreIndex === 3) {
    // Only fbk_ with no id
    return null;
  }

  const id = key.slice(4, lastUnderscoreIndex); // Skip 'fbk_' prefix
  const secret = key.slice(lastUnderscoreIndex + 1);

  // Validate that id and secret contain only allowed characters and are not empty
  if (!id || !secret || !/^[a-zA-Z0-9_-]+$/.test(id) || !/^[a-zA-Z0-9_-]+$/.test(secret)) {
    return null;
  }

  return { id, secret };
};
