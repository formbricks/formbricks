import { OTP, type OTPVerifyOptions } from "otplib";

type TOTPAuthenticatorOptions = {
  window?: number | [number, number];
  period?: OTPVerifyOptions["period"];
  epoch?: OTPVerifyOptions["epoch"];
  t0?: OTPVerifyOptions["t0"];
  algorithm?: OTPVerifyOptions["algorithm"];
  digits?: OTPVerifyOptions["digits"];
};

const createTotp = () => new OTP({ strategy: "totp" });

/**
 * Checks the validity of a TOTP token using a base32-encoded secret.
 *
 * @param token - The token.
 * @param secret - The base32-encoded shared secret.
 * @param opts - The AuthenticatorOptions object.
 * @param opts.window - The amount of past and future tokens considered valid. Either a single value or array of `[past, future]`. Default: `[1, 0]`
 */
export const totpAuthenticatorCheck = (
  token: string,
  secret: string,
  opts: TOTPAuthenticatorOptions = {}
) => {
  const { window = [1, 0], period = 30, ...rest } = opts;
  const [pastWindow, futureWindow] = Array.isArray(window) ? window : [window, window];
  const totp = createTotp();

  const result = totp.verifySync({
    token,
    secret,
    period,
    epochTolerance: [pastWindow * period, futureWindow * period],
    ...rest,
  });

  return result.valid;
};
