export interface PlainCustomerDetails {
  email: string;
  fullName?: string;
  shortName?: string;
  externalId?: string;
}

interface PlainIdentityInput {
  userEmail?: string | null;
  customerDetailsSignature?: string | null;
  userName?: string | null;
  userId?: string | null;
}

/** The identity part of Plain's init/update options: details plus the signature that verifies them. */
export interface PlainIdentity {
  customerDetails: PlainCustomerDetails;
  customerDetailsSignature: string;
}

/**
 * Builds the identity sent to Plain. An email is only ever sent together with its server-computed
 * signature: Plain trusts a bare email, so a missing signature yields no identity at all rather than
 * an unverified one. This backs up the server-side gate, `isPlainChatConfigured` in `lib/plain-chat-config.ts`.
 */
export const buildPlainIdentity = ({
  userEmail,
  customerDetailsSignature,
  userName,
  userId,
}: PlainIdentityInput): PlainIdentity | undefined => {
  if (!userEmail || !customerDetailsSignature) return undefined;
  return {
    customerDetails: {
      email: userEmail,
      fullName: userName ?? undefined,
      shortName: userName?.split(" ")[0] ?? undefined,
      externalId: userId ?? undefined,
    },
    customerDetailsSignature,
  };
};
