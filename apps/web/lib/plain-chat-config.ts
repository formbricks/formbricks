interface PlainChatEnv {
  appId?: string;
  hmacSecret?: string;
}

/**
 * The chat is only offered when Plain can verify who is talking. Without the HMAC secret the
 * browser would send a bare email that Plain trusts as-is, so anyone could claim any customer
 * (`Plain.setCustomerDetails({ email: "victim@…" })`). An app id alone therefore fails closed.
 */
export const isPlainChatConfigured = ({ appId, hmacSecret }: PlainChatEnv): boolean =>
  Boolean(appId) && Boolean(hmacSecret);

/** An app id without the secret: the operator meant to enable the chat but it stays off. */
export const isPlainChatMissingVerification = ({ appId, hmacSecret }: PlainChatEnv): boolean =>
  Boolean(appId) && !hmacSecret;
