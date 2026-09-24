export const isValidEmail = (email: string): boolean => {
  // This regex comes from zod
  const regex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9-]*\.)+[A-Z]{2,}$/i;
  return regex.test(email);
};

/**
 * Canonicalizes an email address for case- and whitespace-insensitive comparison. Two independent
 * callers rely on this being the ONE rule, for the same reason: a second, subtly different rule
 * elsewhere reintroduces the drift each was written to close.
 *
 * - The workflow `send_email` recipient allowlist (ENG-2029) builds the member-email set and queries
 *   it through this rule, so the set and every lookup against it cannot drift apart and silently
 *   weaken the fail-closed guarantee.
 * - Every `User` lookup keyed by an email address (`getUserByEmail`) canonicalizes through it, so our
 *   Prisma lookups agree with Better Auth, which stores and looks users up by `email.toLowerCase()`
 *   (`internal-adapter`: `createUser`, `findUserByEmail`). When the two disagreed, a password reset
 *   for `Alice@example.com` found nobody and silently mailed nothing (ENG-3257).
 *
 * The extra `trim()` cannot make those two disagree: `ZUserEmail` / `z.email()` reject surrounding
 * whitespace, so by the time an address reaches a lookup the trim is a no-op.
 */
export const normalizeEmailForComparison = (email: string): string => email.trim().toLowerCase();
