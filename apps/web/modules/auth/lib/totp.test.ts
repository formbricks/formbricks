import { Authenticator } from "@otplib/core";
import type { AuthenticatorOptions } from "@otplib/core/authenticator";
import { createDigest, createRandomBytes } from "@otplib/plugin-crypto";
import { keyDecoder, keyEncoder } from "@otplib/plugin-thirty-two";
import { describe, expect, test, vi } from "vitest";
import { totpAuthenticatorCheck } from "./totp";

vi.mock("@otplib/core");
vi.mock("@otplib/plugin-crypto");
vi.mock("@otplib/plugin-thirty-two");

describe("totpAuthenticatorCheck", () => {
  const token = "123456";
  const secret = "JBSWY3DPEHPK3PXP";
  const opts: Partial<AuthenticatorOptions> = { window: [1, 0] };

  test("should check a TOTP token with a base32-encoded secret", () => {
    const checkMock = vi.fn().mockReturnValue(true);
    (Authenticator as unknown as vi.Mock).mockImplementation(() => ({
      check: checkMock,
    }));

    const result = totpAuthenticatorCheck(token, secret, opts);

    expect(Authenticator).toHaveBeenCalledWith({
      createDigest,
      createRandomBytes,
      keyDecoder,
      keyEncoder,
      window: [1, 0],
    });
    expect(checkMock).toHaveBeenCalledWith(token, secret);
    expect(result).toBe(true);
  });

  test("should use default window if none is provided", () => {
    const checkMock = vi.fn().mockReturnValue(true);
    (Authenticator as unknown as vi.Mock).mockImplementation(() => ({
      check: checkMock,
    }));

    const result = totpAuthenticatorCheck(token, secret);

    expect(Authenticator).toHaveBeenCalledWith({
      createDigest,
      createRandomBytes,
      keyDecoder,
      keyEncoder,
      window: [1, 0],
    });
    expect(checkMock).toHaveBeenCalledWith(token, secret);
    expect(result).toBe(true);
  });

  test("should throw an error for invalid token format", () => {
    (Authenticator as unknown as vi.Mock).mockImplementation(() => ({
      check: () => {
        throw new Error("Invalid token format");
      },
    }));

    expect(() => {
      totpAuthenticatorCheck("invalidToken", secret);
    }).toThrow("Invalid token format");
  });

  test("should throw an error for invalid secret format", () => {
    (Authenticator as unknown as vi.Mock).mockImplementation(() => ({
      check: () => {
        throw new Error("Invalid secret format");
      },
    }));

    expect(() => {
      totpAuthenticatorCheck(token, "invalidSecret");
    }).toThrow("Invalid secret format");
  });

  test("should return false if token verification fails", () => {
    const checkMock = vi.fn().mockReturnValue(false);
    (Authenticator as unknown as vi.Mock).mockImplementation(() => ({
      check: checkMock,
    }));

    const result = totpAuthenticatorCheck(token, secret);
    expect(result).toBe(false);
  });
});
