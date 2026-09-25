import { ScureBase32Plugin, generateSync } from "otplib";
import { describe, expect, test } from "vitest";
import { generateTotpKeyUri, generateTotpSecret, totpAuthenticatorCheck } from "./totp";

const base32 = new ScureBase32Plugin();

/** A 20-byte secret produced by otplib 12's `authenticator.generateSecret(20)`. Its tokens at the
 * fixed epoch below were captured from otplib 12 and are asserted verbatim in "tokens for a secret
 * enrolled under otplib 12 are unchanged". */
const LEGACY_SECRET = "AAAQEAYEAUDAOCAJBIFQYDIOB4IBCEQT";
const fixedEpoch = 1_700_000_000; // seconds

describe("totpAuthenticatorCheck", () => {
  const secret = generateTotpSecret();

  test("should check a TOTP token with a base32-encoded secret", () => {
    const token = generateSync({ secret, epoch: fixedEpoch });
    const result = totpAuthenticatorCheck(token, secret, { epoch: fixedEpoch, epochTolerance: [30, 0] });
    expect(result).toBe(true);
  });

  test("should use default tolerance if none is provided", () => {
    // Generate a token for one time-step in the past and verify it at current epoch.
    // Default tolerance is [30, 0] seconds, so previous-step tokens are accepted.
    const token = generateSync({ secret, epoch: fixedEpoch });
    const result = totpAuthenticatorCheck(token, secret, { epoch: fixedEpoch + 30 });
    expect(result).toBe(true);
  });

  test("should return false for invalid token format", () => {
    // otplib 13 throws on a token that is not 6 digits; callers need a boolean.
    const result = totpAuthenticatorCheck("invalidToken", secret);
    expect(result).toBe(false);
  });

  test("should return false for invalid secret format", () => {
    // otplib 13 throws on a secret that is not valid base32; callers need a boolean.
    const token = generateSync({ secret, epoch: fixedEpoch });
    const result = totpAuthenticatorCheck(token, "invalidSecret", { epoch: fixedEpoch });
    expect(result).toBe(false);
  });

  test("should return false for a secret below otplib's 16-byte floor", () => {
    // Well-formed base32, only 10 decoded bytes — otplib 13 raises SecretTooShortError.
    expect(totpAuthenticatorCheck("123456", "JBSWY3DPEHPK3PXP", { epoch: fixedEpoch })).toBe(false);
  });

  test("should return false if token verification fails", () => {
    const token = generateSync({ secret, epoch: fixedEpoch });
    const result = totpAuthenticatorCheck(token, secret, { epoch: fixedEpoch + 60 });
    expect(result).toBe(false);
  });

  test("should reject a token from the future", () => {
    const token = generateSync({ secret, epoch: fixedEpoch + 30 });
    expect(totpAuthenticatorCheck(token, secret, { epoch: fixedEpoch })).toBe(false);
  });

  test("tokens for a secret enrolled under otplib 12 are unchanged", () => {
    // Captured from otplib 12 for LEGACY_SECRET: everyone already enrolled keeps their app working.
    expect(generateSync({ secret: LEGACY_SECRET, epoch: fixedEpoch })).toBe("367345");
    expect(totpAuthenticatorCheck("367345", LEGACY_SECRET, { epoch: fixedEpoch })).toBe(true);
    expect(totpAuthenticatorCheck("517782", LEGACY_SECRET, { epoch: fixedEpoch })).toBe(true); // previous step
  });
});

describe("generateTotpSecret", () => {
  test("returns a 32-character base32 secret, as otplib 12 did", () => {
    const secret = generateTotpSecret();
    expect(secret).toHaveLength(32);
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32.decode(secret)).toHaveLength(20);
  });

  test("clears the high bit of every byte", () => {
    // Load-bearing for cutover/reencode-two-factor.ts: it hands Better Auth these bytes as a latin1
    // string, which only survives BA's utf8 HMAC while every byte is <= 0x7F. otplib 13's own
    // generateSecret() returns full 8-bit entropy, which is why we do not use it.
    for (let i = 0; i < 200; i++) {
      for (const byte of base32.decode(generateTotpSecret())) {
        expect(byte).toBeLessThanOrEqual(0x7f);
      }
    }
  });

  test("does not repeat", () => {
    expect(generateTotpSecret()).not.toBe(generateTotpSecret());
  });
});

describe("generateTotpKeyUri", () => {
  test("builds an otpauth URI an authenticator app can enrol from", () => {
    const uri = generateTotpKeyUri("user@example.com", LEGACY_SECRET);
    expect(uri).toBe(
      "otpauth://totp/Formbricks:user%40example.com?secret=AAAQEAYEAUDAOCAJBIFQYDIOB4IBCEQT&issuer=Formbricks"
    );
  });
});
