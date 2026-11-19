/**
 * The scopes that give a client nothing beyond who the user is, shown on the consent screen as always
 * granted: they aren't part of the permission matrix, and denying them means denying the request.
 */
const IDENTITY_SCOPES = {
  name_and_email: ["profile", "email"],
  stay_signed_in: ["offline_access"],
} as const;

export type TConsentIdentityAccess = keyof typeof IDENTITY_SCOPES;

/** Which of the always-granted rows the request's scopes call for, in the order the screen lists them. */
export const getConsentIdentityAccess = (scopes: readonly string[]): TConsentIdentityAccess[] =>
  (Object.keys(IDENTITY_SCOPES) as TConsentIdentityAccess[]).filter((row) =>
    IDENTITY_SCOPES[row].some((scope) => scopes.includes(scope))
  );
