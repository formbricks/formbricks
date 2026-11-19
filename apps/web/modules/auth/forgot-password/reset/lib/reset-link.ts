import { getSearchParamString } from "@/modules/auth/lib/callback-url";

export type TResetPasswordSearchParams = {
  readonly token?: string | string[];
  readonly error?: string | string[];
};

/**
 * The token a reset link can still be used with, or null when the link is dead.
 *
 * Better Auth's `GET /api/auth/reset-password/:token` checks the token before the page loads: a live one
 * redirects here with `?token=…`, an expired, used or unknown one with `?error=INVALID_TOKEN` and no token.
 * Either an error or a missing token means the new-password form can never succeed.
 */
export const getResetPasswordToken = (searchParams: TResetPasswordSearchParams): string | null => {
  if (searchParams.error !== undefined) return null;
  const token = getSearchParamString(searchParams.token);
  return token.trim() ? token : null;
};
