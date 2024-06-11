import "server-only";
import { getMembershipByUserIdOrganizationId } from "membership/service";
import { getAccessFlags } from "membership/utils";
import { getOrganizationByEnvironmentId } from "organization/service";
import { ZId } from "@formbricks/types/environment";
import { cache } from "../cache";
import { hasUserEnvironmentAccess } from "../environment/auth";
import { validateInputs } from "../utils/validate";
import { personCache } from "./cache";
import { getPerson } from "./service";

export const canUserAccessPerson = (userId: string, personId: string): Promise<boolean> =>
  cache(
    async () => {
      validateInputs([userId, ZId], [personId, ZId]);
      if (!userId) return false;

      try {
        const person = await getPerson(personId);
        if (!person) return false;

        const hasAccessToEnvironment = await hasUserEnvironmentAccess(userId, person.environmentId);
        if (!hasAccessToEnvironment) return false;

        return true;
      } catch (error) {
        throw error;
      }
    },
    [`canUserAccessPerson-${userId}-people-${personId}`],
    {
      tags: [personCache.tag.byId(personId)],
    }
  )();

export const verifyUserRoleAccess = async (
  environmentId: string,
  userId: string
): Promise<{
  hasCreateOrUpdateAccess: boolean;
  hasDeleteAccess: boolean;
}> => {
  try {
    const accessObject = {
      hasCreateOrUpdateAccess: true,
      hasDeleteAccess: true,
    };

    const organization = await getOrganizationByEnvironmentId(environmentId);
    if (!organization) {
      throw new Error("Organization not found");
    }

    const currentUserMembership = await getMembershipByUserIdOrganizationId(userId, organization.id);
    const { isViewer } = getAccessFlags(currentUserMembership?.role);

    if (isViewer) {
      accessObject.hasCreateOrUpdateAccess = false;
      accessObject.hasDeleteAccess = false;
    }
    return accessObject;
  } catch (error) {
    throw error;
  }
};
