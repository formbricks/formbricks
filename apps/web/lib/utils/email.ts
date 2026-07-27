export const isValidEmail = (email: string): boolean => {
  // This regex comes from zod
  const regex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9-]*\.)+[A-Z]{2,}$/i;
  return regex.test(email);
};

/**
 * Canonicalizes an email address for case- and whitespace-insensitive comparison. The workflow
 * `send_email` recipient allowlist (ENG-2029) is built and queried through this single rule so the
 * member-email set and every lookup against it cannot drift apart and silently weaken the
 * fail-closed guarantee.
 */
export const normalizeEmailForComparison = (email: string): string => email.trim().toLowerCase();
