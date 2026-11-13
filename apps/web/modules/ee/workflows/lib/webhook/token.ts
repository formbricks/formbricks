import "server-only";
import { randomBytes } from "node:crypto";
import type { WebhookTokenIssuer } from "@formbricks/workflows/server";
import { ENCRYPTION_KEY } from "@/lib/constants";
import { constantTimeEqual, hashSha256, symmetricDecrypt, symmetricEncrypt } from "@/lib/crypto";

/** 128 bits, the Webhook Secret URL's entropy (ADR 0041). */
const WEBHOOK_TOKEN_BYTES = 16;

/**
 * Issues Webhook Secret URL tokens for `@formbricks/workflows`: a random token stored only as a SHA-256
 * hash (to check calls; a 128-bit random value needs no slow hash) and an AES-GCM copy under
 * `ENCRYPTION_KEY` (so the editor can show the URL again). The plaintext never leaves this module except
 * through `reveal`, which only the write-access webhook operations call.
 */
export const webhookTokenIssuer: WebhookTokenIssuer = {
  issue: () => {
    const token = randomBytes(WEBHOOK_TOKEN_BYTES).toString("base64url");
    return { hash: hashSha256(token), encrypted: symmetricEncrypt(token, ENCRYPTION_KEY) };
  },
  reveal: (encrypted) => symmetricDecrypt(encrypted, ENCRYPTION_KEY),
};

/** Whether a token from a call's path matches a stored hash, compared in constant time. */
export const isWebhookTokenMatch = (token: string, storedHash: string): boolean =>
  token.length > 0 && constantTimeEqual(hashSha256(token), storedHash, "hex");
