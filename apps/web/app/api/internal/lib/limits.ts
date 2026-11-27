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

/**
 * An identifier a client names rather than one the database generated: a survey element or variable id,
 * a hidden-field or attribute key, a filter operand. Survey ids of this kind are short slugs; 255 is far
 * above any the editor produces.
 */
export const IDENTIFIER_MAX_LENGTH = 255;

/**
 * A free-text value a filter or condition compares against: a segment filter, a quota condition, a
 * response filter. Far above anything typed into those inputs.
 */
export const FILTER_TEXT_MAX_LENGTH = 5000;

/**
 * Items in a list a user builds by picking in a form: workspaces, surveys, questions, mappings. Far above
 * any real selection, and half the request-wide array cap (`V3_REQUEST_ARRAY_MAX_ITEMS`).
 */
export const PICKED_ITEMS_MAX = 500;
