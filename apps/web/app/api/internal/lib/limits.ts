/**
 * Caps shared by more than one internal route (CODING_STANDARDS.md "Input Limits"). A cap that only one
 * feature uses lives beside that feature's schemas.
 */

/**
 * An emailed link's token (password reset, email change confirmation): a signed token a few hundred
 * characters long. Generous, and still small enough that no request makes the server verify megabytes.
 */
export const EMAILED_TOKEN_MAX = 4096;

/**
 * The largest body a pre-login route (`auth: "none"`) reads, in bytes, passed as the wrapper's
 * `bodyLimitBytes`. Anyone can send these requests, so they get far less than the wrapper's 2 MB default.
 * The largest real one is a sign-up: a name, an email, a password and two tokens of up to 4096 characters
 * (an invite and a Turnstile token), well under this.
 */
export const PRE_LOGIN_BODY_LIMIT_BYTES = 16 * 1024;
