import { Authenticator } from "@otplib/core";
import type { AuthenticatorOptions } from "@otplib/core/authenticator";
import { createDigest, createRandomBytes } from "@otplib/plugin-crypto";
import { keyDecoder, keyEncoder } from "@otplib/plugin-thirty-two";
import { describe, expect, it, vi } from "vitest";
import { totpAuthenticatorCheck } from "./totp";

vi.mock("@otplib/core");
vi.mock("@otplib/plugin-crypto");
vi.mock("@otplib/plugin-thirty-two");

describe("totpAuthenticatorCheck", () => {
  const token = "123456";
  const secret = "JBSWY3DPEHPK3PXP";
  const opts: Partial<AuthenticatorOptions> = { window: [1, 0] };

  it("should check the validity of a TOTP token using a base32-encoded secret", () => {
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

  it("should use default window if not provided", () => {
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
});
