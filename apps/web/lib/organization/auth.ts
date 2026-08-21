import "server-only";
import { ZId } from "@formbricks/types/common";
import { validateInputs } from "../utils/validate";
import { getOrganizationsByUserId } from "./service";

export const canUserAccessOrganization = async (userId: string, organizationId: string): Promise<boolean> => {
  validateInputs([userId, ZId], [organizationId, ZId]);

  try {
    const userOrganizations = await getOrganizationsByUserId(userId);
    return userOrganizations.some((organization) => organization.id === organizationId);
  } catch (error) {
    throw error;
  }
};
