import crypto from "node:crypto";
import { ScureBase32Plugin, generateURI, verifySync } from "otplib";

/** Bytes of entropy per secret. 20 bytes base32-encode to exactly 32 characters, no padding — the
 * length `two-factor-auth.ts` sanity-checks before it trusts a decrypted secret. */
const SECRET_BYTES = 20;

/** One TOTP time step, in seconds. otplib's default period, spelled out because the tolerance below
 * is expressed in seconds rather than in steps. */
const TIME_STEP_SECONDS = 30;

/** Accept the previous step's token as well as the current one, and nothing from the future — the
 * same asymmetry otplib 12 expressed as `window: [1, 0]`. */
const DEFAULT_EPOCH_TOLERANCE: [number, number] = [TIME_STEP_SECONDS, 0];

const base32 = new ScureBase32Plugin();

export interface TotpCheckOptions {
  /** Unix timestamp in SECONDS (otplib 12 took milliseconds here). Defaults to now. */
  epoch?: number;
  /** Seconds of leeway, as `[past, future]` or a symmetric number. Default: `[30, 0]`. */
  epochTolerance?: number | [number, number];
}

/**
 * Generate a TOTP secret for a new enrolment, as a 32-character base32 string.
 *
 * The high bit of every random byte is cleared before encoding. That is not decoration: otplib 12's
 * `authenticator.generateSecret(20)` ascii-masked its entropy (`randomBytes(20).toString("ascii")`)
 * on the way through `keyEncoder`, and `cutover/reencode-two-factor.ts` depends on the result —
 * it base32-decodes this secret and hands Better Auth the bytes as a latin1 string, which only
 * round-trips through Better Auth's utf8 HMAC while every byte is <= 0x7F. otplib 13's
 * `generateSecret()` returns full 8-bit entropy, so adopting it would silently break the TOTP codes
 * of everyone who enrolled after the upgrade (the BA row and the authenticator app would key off
 * different bytes). Keeping the mask keeps new enrolments byte-identical to the old ones.
 *
 * The mask costs one bit per byte: 140 bits of entropy rather than 160, which is what every secret
 * already in the database has and is far above the 128-bit floor otplib 13 enforces.
 */
export const generateTotpSecret = (): string => {
  const masked = Uint8Array.from(crypto.randomBytes(SECRET_BYTES), (byte) => byte & 0x7f);
  return base32.encode(masked);
};

/**
 * Build the `otpauth://` URI an authenticator app scans, for `label` (the user) under the Formbricks
 * issuer. Period, digits and algorithm are otplib 13's defaults (30s / 6 / SHA-1) and match what
 * otplib 12 wrote into the URI explicitly, so existing apps enrol the same way.
 */
export const generateTotpKeyUri = (label: string, secret: string): string =>
  generateURI({ issuer: "Formbricks", label, secret });

/**
 * Checks the validity of a TOTP token using a base32-encoded secret.
 *
 * Returns false rather than throwing on malformed input. otplib 13 raises on a token of the wrong
 * length, a secret that is not valid base32, and a secret under 16 bytes — all cases otplib 12
 * answered with `false`, and all cases that reach here as ordinary user input (a typo in the code
 * box) or as a corrupted stored secret. Callers turn `false` into "Invalid code"; letting these
 * throw would turn a mistyped digit into a 500.
 *
 * @param token - The token.
 * @param secret - The base32-encoded shared secret.
 * @param opts - Epoch and tolerance overrides; see {@link TotpCheckOptions}.
 */
export const totpAuthenticatorCheck = (
  token: string,
  secret: string,
  opts: TotpCheckOptions = {}
): boolean => {
  const { epochTolerance = DEFAULT_EPOCH_TOLERANCE, ...rest } = opts;
  try {
    return verifySync({ secret, token, epochTolerance, ...rest }).valid;
  } catch {
    return false;
  }
};
