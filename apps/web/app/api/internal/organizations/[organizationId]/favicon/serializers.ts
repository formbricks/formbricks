/** The organization's favicon, as the favicon customization settings edit it. */
export type TOrganizationFaviconResource = {
  organizationId: string;
  faviconUrl: string;
};

export const serializeOrganizationFavicon = (
  organizationId: string,
  faviconUrl: string
): TOrganizationFaviconResource => ({ organizationId, faviconUrl });
