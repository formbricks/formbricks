import "server-only";
import { createHmac } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Computes the HMAC-SHA256 hash Plain uses to verify a customer's identity.
 * The hash is a bearer credential, so it must only ever be computed server-side
 * with the secret from Plain's Chat settings and passed to the client already hashed.
 * Returns null when no secret is configured, in which case the chat runs unverified.
 */
export const computePlainEmailHash = (email: string): string | null => {
  const secret = env.PLAIN_CHAT_HMAC_SECRET;
  if (!secret) return null;

  return createHmac("sha256", secret).update(email).digest("hex");
};
