import { Authenticator } from "@otplib/core";
import type { AuthenticatorOptions } from "@otplib/core/authenticator";
import { createDigest, createRandomBytes } from "@otplib/plugin-crypto";
import { keyDecoder, keyEncoder } from "@otplib/plugin-thirty-two";
import { describe, expect, test } from "vitest";
import { totpAuthenticatorCheck } from "./totp";

const createAuthenticator = (opts: Partial<AuthenticatorOptions> = {}) =>
  new Authenticator({
    createDigest,
    createRandomBytes,
    keyDecoder,
    keyEncoder,
    ...opts,
  });

describe("totpAuthenticatorCheck", () => {
  const secret = "JBSWY3DPEHPK3PXP";
  const fixedEpoch = 1_700_000_000_000;

  test("should check a TOTP token with a base32-encoded secret", () => {
    const token = createAuthenticator({ epoch: fixedEpoch }).generate(secret);
    const result = totpAuthenticatorCheck(token, secret, { epoch: fixedEpoch, window: [1, 0] });
    expect(result).toBe(true);
  });

  test("should use default window if none is provided", () => {
    // Generate a token for one time-step in the past and verify it at current epoch.
    // Default window is [1, 0], so previous-step tokens are accepted.
    const token = createAuthenticator({ epoch: fixedEpoch }).generate(secret);
    const result = totpAuthenticatorCheck(token, secret, { epoch: fixedEpoch + 30_000 });
    expect(result).toBe(true);
  });

  test("should return false for invalid token format", () => {
    const result = totpAuthenticatorCheck("invalidToken", secret);
    expect(result).toBe(false);
  });

  test("should return false for invalid secret format", () => {
    const token = createAuthenticator({ epoch: fixedEpoch }).generate(secret);
    const result = totpAuthenticatorCheck(token, "invalidSecret", { epoch: fixedEpoch });
    expect(result).toBe(false);
  });

  test("should return false if token verification fails", () => {
    const token = createAuthenticator({ epoch: fixedEpoch }).generate(secret);
    const result = totpAuthenticatorCheck(token, secret, { epoch: fixedEpoch + 60_000 });
    expect(result).toBe(false);
  });
});
