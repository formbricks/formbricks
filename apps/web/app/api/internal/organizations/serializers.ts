import type { TOrganization } from "@formbricks/types/organizations";

/** The organization settings the general settings page shows. Billing and whitelabel stay out. */
export type TOrganizationSettingsResource = {
  id: string;
  name: string;
  isAISmartToolsEnabled: boolean;
  displayTimeZone: string | null;
};

export const serializeOrganizationSettings = (
  organization: TOrganization
): TOrganizationSettingsResource => ({
  id: organization.id,
  name: organization.name,
  isAISmartToolsEnabled: organization.isAISmartToolsEnabled,
  displayTimeZone: organization.displayTimeZone ?? null,
});
