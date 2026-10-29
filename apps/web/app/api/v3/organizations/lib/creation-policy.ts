import "server-only";
import { getHasNoOrganizations } from "@/lib/instance/service";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";

/**
 * Whether this instance lets a signed-in person create an organization: the first one on a fresh instance,
 * or any number once the multi-organization licence is on.
 *
 * One rule for every door. `createV3Organization` enforces it, `get_account_context` reports it as
 * `canCreateOrganization` and the organization switcher shows its "Create organization" entry only when it
 * holds, so the three cannot disagree about what is allowed.
 */
export async function getOrganizationCreationPolicy(): Promise<{
  allowed: boolean;
  hasNoOrganizations: boolean;
  isMultiOrgEnabled: boolean;
}> {
  const [hasNoOrganizations, isMultiOrgEnabled] = await Promise.all([
    getHasNoOrganizations(),
    getIsMultiOrgEnabled(),
  ]);

  return { allowed: hasNoOrganizations || isMultiOrgEnabled, hasNoOrganizations, isMultiOrgEnabled };
}
