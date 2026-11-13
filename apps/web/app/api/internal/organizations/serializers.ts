import type { TOrganization } from "@formbricks/types/organizations";

/** The organization settings the general settings page shows. Billing and whitelabel stay out. */
export type TOrganizationSettingsResource = {
  id: string;
  name: string;
  isAISmartToolsEnabled: boolean;
  displayTimeZone: string | null;
};

/** A newly created organization: enough to go on to its next setup step. */
export type TCreatedOrganizationResource = { id: string; name: string };

/** An organization as the organization switcher lists it: its id and name. */
export type TOrganizationOptionResource = { id: string; name: string };

export const serializeOrganizationOption = (organization: {
  id: string;
  name: string;
}): TOrganizationOptionResource => ({ id: organization.id, name: organization.name });

export const serializeCreatedOrganization = (organization: TOrganization): TCreatedOrganizationResource => ({
  id: organization.id,
  name: organization.name,
});

export const serializeOrganizationSettings = (
  organization: TOrganization
): TOrganizationSettingsResource => ({
  id: organization.id,
  name: organization.name,
  isAISmartToolsEnabled: organization.isAISmartToolsEnabled,
  displayTimeZone: organization.displayTimeZone ?? null,
});
