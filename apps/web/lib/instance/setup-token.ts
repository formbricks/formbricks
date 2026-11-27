import "server-only";
import { SETUP_TOKEN } from "@/lib/constants";
import { constantTimeEqual } from "@/lib/crypto";

/**
 * The optional setup token (ENG-7313). Off by default so a plain self-hosted install keeps its
 * zero-config setup; an operator who exposes a new instance before finishing setup sets `SETUP_TOKEN`,
 * and the first administrator then has to present it.
 */
export const isSetupTokenConfigured = (): boolean => Boolean(SETUP_TOKEN);

/**
 * Whether the fresh-instance exception may proceed with the token the caller supplied. Always true when
 * no token is configured; otherwise a constant-time comparison, never `===`.
 */
export const isSetupTokenSatisfied = (supplied: string | undefined): boolean => {
  if (!SETUP_TOKEN) return true;
  if (!supplied) return false;
  return constantTimeEqual(supplied, SETUP_TOKEN);
};
