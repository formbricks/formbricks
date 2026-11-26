import type { TOrganizationWhitelabel } from "@formbricks/types/organizations";

/** What the organization's emails show in their header. */
export type TOrganizationEmailLogo = {
  /** The organization's own logo, or null for none. */
  logoUrl: string | null;
  /** The organization removed its logo: emails show none, not the Formbricks fallback. */
  hideLogo: boolean;
};

/**
 * Reads the email logo from an organization's whitelabel settings. `logoUrl: null` alone means the
 * Formbricks logo stands in; only `hideLogo` means no logo at all (ENG-545).
 */
export const getEmailLogo = (
  whitelabel: TOrganizationWhitelabel | null | undefined
): TOrganizationEmailLogo => ({
  logoUrl: whitelabel?.logoUrl ?? null,
  hideLogo: whitelabel?.hideLogo === true,
});

/**
 * The logo the email customization preview shows: the organization's own, none after a removal,
 * otherwise the Formbricks logo. An empty string means no logo.
 */
export const getEmailLogoPreviewUrl = (
  whitelabel: TOrganizationWhitelabel | null | undefined,
  fbLogoUrl: string
): string => {
  const { logoUrl, hideLogo } = getEmailLogo(whitelabel);
  // A removal wins over any stored URL, exactly as in the rendered email.
  if (hideLogo) return "";
  return logoUrl || fbLogoUrl;
};
