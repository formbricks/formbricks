import "server-only";
import { getHasNoOrganizations, getIsEligibleFirstOrganizationOwner } from "@/lib/instance/service";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";

export type TSetupOrganizationCreation =
  | {
      allowed: true;
      isFirstOrganization: boolean;
      /**
       * The single-organization instance's only organization: the caller must create it with
       * `createOrganizationIfNoneExists`, so a concurrent claim cannot create a second one.
       */
      claimsInstance: boolean;
    }
  | { allowed: false; reason: "not_fresh" | "not_eligible" };

/**
 * Whether this user may create an organization from the setup flow (`flow: "setup"`), and whether it would
 * be the instance's first. The one place the rule lives: `POST /api/internal/organizations` enforces it and
 * the setup page asks it, so the form is offered exactly where the route accepts it.
 *
 * - Multi-organization licence: anyone may, as with `flow: "additional"`; each user gets their own
 *   organization, so the instance-level owner rule does not apply.
 * - Otherwise only while no organization exists, and then only by the bootstrap administrator or, failing
 *   that account, the earliest user (`getIsEligibleFirstOrganizationOwner`, ENG-7313): being signed in is
 *   not enough to become the owner of the instance's only organization.
 */
export const resolveSetupOrganizationCreation = async (
  userId: string
): Promise<TSetupOrganizationCreation> => {
  const [hasNoOrganizations, isMultiOrgEnabled] = await Promise.all([
    getHasNoOrganizations(),
    getIsMultiOrgEnabled(),
  ]);
  if (isMultiOrgEnabled) {
    return { allowed: true, isFirstOrganization: hasNoOrganizations, claimsInstance: false };
  }
  if (!hasNoOrganizations) return { allowed: false, reason: "not_fresh" };
  return (await getIsEligibleFirstOrganizationOwner(userId))
    ? { allowed: true, isFirstOrganization: true, claimsInstance: true }
    : { allowed: false, reason: "not_eligible" };
};
