import { describe, expect, test } from "vitest";
import { getEmailLogo, getEmailLogoPreviewUrl } from "./email-logo";

const FB_LOGO_URL = "https://app.example.com/logo-transparent.png";
const CUSTOM_LOGO_URL = "/storage/clp123456789012345678901234/public/logo.png";

describe("getEmailLogo", () => {
  test.each([
    ["no whitelabel settings", undefined, { logoUrl: null, hideLogo: false }],
    ["null whitelabel settings", null, { logoUrl: null, hideLogo: false }],
    ["a cleared logo without a removal", { logoUrl: null }, { logoUrl: null, hideLogo: false }],
    ["a custom logo", { logoUrl: CUSTOM_LOGO_URL }, { logoUrl: CUSTOM_LOGO_URL, hideLogo: false }],
    ["a removed logo (ENG-545)", { logoUrl: null, hideLogo: true }, { logoUrl: null, hideLogo: true }],
  ])("reads %s", (_label, whitelabel, expected) => {
    expect(getEmailLogo(whitelabel)).toEqual(expected);
  });
});

describe("getEmailLogoPreviewUrl", () => {
  test("previews the Formbricks logo for an organization that never touched the setting", () => {
    expect(getEmailLogoPreviewUrl(undefined, FB_LOGO_URL)).toBe(FB_LOGO_URL);
    expect(getEmailLogoPreviewUrl({ logoUrl: null }, FB_LOGO_URL)).toBe(FB_LOGO_URL);
  });

  test("previews the organization's own logo", () => {
    expect(getEmailLogoPreviewUrl({ logoUrl: CUSTOM_LOGO_URL }, FB_LOGO_URL)).toBe(CUSTOM_LOGO_URL);
  });

  test("previews no logo once it was removed, so it stays gone after a reload (ENG-545)", () => {
    expect(getEmailLogoPreviewUrl({ logoUrl: null, hideLogo: true }, FB_LOGO_URL)).toBe("");
  });

  test("previews no logo when removed, even with a stale logo URL, as the email renders it", () => {
    expect(getEmailLogoPreviewUrl({ logoUrl: CUSTOM_LOGO_URL, hideLogo: true }, FB_LOGO_URL)).toBe("");
  });
});
