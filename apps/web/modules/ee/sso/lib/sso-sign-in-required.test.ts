import { describe, expect, test } from "vitest";
import { SSO_SIGN_IN_REQUIRED_CODE, getSsoSignInRequiredProviderNames } from "./sso-sign-in-required";

describe("getSsoSignInRequiredProviderNames", () => {
  test("reads the provider names off an SSO-required refusal, as the client receives it", async () => {
    // The auth client spreads the response body into its error and adds the status.
    const error = {
      code: SSO_SIGN_IN_REQUIRED_CODE,
      message: "Your account uses single sign-on. Sign in with Google or Microsoft.",
      providerNames: ["Google", "Microsoft"],
      status: 403,
      statusText: "Forbidden",
    };

    expect(getSsoSignInRequiredProviderNames(error)).toEqual(["Google", "Microsoft"]);
  });

  test.each([
    ["a wrong password", { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" }],
    ["another error carrying names", { code: "OTHER", providerNames: ["Google"] }],
    ["a refusal without names", { code: SSO_SIGN_IN_REQUIRED_CODE }],
    ["a refusal with an empty list", { code: SSO_SIGN_IN_REQUIRED_CODE, providerNames: [] }],
    ["a refusal whose names are not strings", { code: SSO_SIGN_IN_REQUIRED_CODE, providerNames: [1, ""] }],
    ["no error object", null],
    ["a string", "SSO_SIGN_IN_REQUIRED"],
  ])("is null for %s, so the form falls back to its generic message", (_label, error) => {
    expect(getSsoSignInRequiredProviderNames(error)).toBeNull();
  });
});
