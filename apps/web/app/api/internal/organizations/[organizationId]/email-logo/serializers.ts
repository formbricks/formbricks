/** The organization's email logo, as the email customization settings edit it. */
export type TOrganizationEmailLogoResource = {
  organizationId: string;
  logoUrl: string;
};

export const serializeOrganizationEmailLogo = (
  organizationId: string,
  logoUrl: string
): TOrganizationEmailLogoResource => ({ organizationId, logoUrl });
