/**
 * Caps shared by more than one internal route (CODING_STANDARDS.md "Input Limits"). A cap that only one
 * feature uses lives beside that feature's schemas.
 */

/**
 * An emailed link's token (password reset, email change confirmation): a signed token a few hundred
 * characters long. Generous, and still small enough that no request makes the server verify megabytes.
 */
export const EMAILED_TOKEN_MAX = 4096;
