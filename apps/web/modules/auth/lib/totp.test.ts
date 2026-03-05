import { OTP } from "otplib";
import { describe, expect, test, vi } from "vitest";
import { totpAuthenticatorCheck } from "./totp";

vi.mock("otplib", () => ({
  OTP: vi.fn(),
}));

describe("totpAuthenticatorCheck", () => {
  const token = "123456";
  const secret = "JBSWY3DPEHPK3PXP";
  const opts = { window: [1, 0] as [number, number] };

  test("should check a TOTP token with a base32-encoded secret", () => {
    const verifySyncMock = vi.fn().mockReturnValue({ valid: true });
    (OTP as unknown as vi.Mock).mockImplementation(function OTP() {
      return {
        verifySync: verifySyncMock,
      };
    });

    const result = totpAuthenticatorCheck(token, secret, opts);

    expect(verifySyncMock).toHaveBeenCalledWith({
      token,
      secret,
      period: 30,
      epochTolerance: [30, 0],
    });
    expect(result).toBe(true);
  });

  test("should use default window if none is provided", () => {
    const verifySyncMock = vi.fn().mockReturnValue({ valid: true });
    (OTP as unknown as vi.Mock).mockImplementation(function OTP() {
      return {
        verifySync: verifySyncMock,
      };
    });

    const result = totpAuthenticatorCheck(token, secret);

    expect(verifySyncMock).toHaveBeenCalledWith({
      token,
      secret,
      period: 30,
      epochTolerance: [30, 0],
    });
    expect(result).toBe(true);
  });

  test("should throw an error for invalid token format", () => {
    (OTP as unknown as vi.Mock).mockImplementation(function OTP() {
      return {
        verifySync: () => {
          throw new Error("Invalid token format");
        },
      };
    });

    expect(() => {
      totpAuthenticatorCheck("invalidToken", secret);
    }).toThrow("Invalid token format");
  });

  test("should throw an error for invalid secret format", () => {
    (OTP as unknown as vi.Mock).mockImplementation(function OTP() {
      return {
        verifySync: () => {
          throw new Error("Invalid secret format");
        },
      };
    });

    expect(() => {
      totpAuthenticatorCheck(token, "invalidSecret");
    }).toThrow("Invalid secret format");
  });

  test("should return false if token verification fails", () => {
    const verifySyncMock = vi.fn().mockReturnValue({ valid: false });
    (OTP as unknown as vi.Mock).mockImplementation(function OTP() {
      return {
        verifySync: verifySyncMock,
      };
    });

    const result = totpAuthenticatorCheck(token, secret);
    expect(result).toBe(false);
  });
});
