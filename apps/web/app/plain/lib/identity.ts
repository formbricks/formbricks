import "server-only";
import { createHmac } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Computes Plain's `customerDetailsSignature`: an HMAC-SHA256 over the customer's email and, when
 * present, their external ID. Plain only accepts an external ID from the chat widget when it is
 * signed alongside the email, so the signature must cover every identifier we send.
 * See https://www.plain.com/docs/product/channels/chat-authentication
 *
 * The signature is a bearer credential, so it must only ever be computed server-side with the
 * secret from Plain's Chat settings and passed to the client already signed.
 * Returns null when no secret is configured. The chat is never mounted in that case
 * (`IS_PLAIN_CHAT_CONFIGURED` requires the secret), and the client refuses to send an
 * email without its signature, so a null here means no identity reaches Plain at all.
 */
export const computePlainCustomerDetailsSignature = ({
  email,
  externalId,
}: {
  email: string;
  externalId?: string;
}): string | null => {
  const secret = env.PLAIN_CHAT_HMAC_SECRET;
  if (!secret) return null;

  // Plain verifies the exact bytes: keys sorted alphabetically at every level, no whitespace, `v` = 1.
  const message =
    externalId === undefined ? email : JSON.stringify({ email, identifiers: { externalId }, v: 1 });

  return createHmac("sha256", secret).update(message).digest("hex");
};
