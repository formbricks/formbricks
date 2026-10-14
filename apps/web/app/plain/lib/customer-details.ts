export interface PlainCustomerDetails {
  email: string;
  emailHash: string;
  fullName?: string;
  shortName?: string;
  externalId?: string;
}

interface PlainIdentityInput {
  userEmail?: string | null;
  emailHash?: string | null;
  userName?: string | null;
  userId?: string | null;
}

/**
 * Builds the identity sent to Plain. An email is only ever sent together with its server-computed
 * hash: Plain trusts a bare email, so a missing hash yields no identity at all rather than an
 * unverified one. This backs up the server-side gate, `isPlainChatConfigured` in `lib/plain-chat-config.ts`.
 */
export const buildPlainCustomerDetails = ({
  userEmail,
  emailHash,
  userName,
  userId,
}: PlainIdentityInput): PlainCustomerDetails | undefined => {
  if (!userEmail || !emailHash) return undefined;
  return {
    email: userEmail,
    emailHash,
    fullName: userName ?? undefined,
    shortName: userName?.split(" ")[0] ?? undefined,
    externalId: userId ?? undefined,
  };
};
