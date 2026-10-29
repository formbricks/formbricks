import "server-only";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { validateInputs } from "@/lib/utils/validate";

/**
 * How many workspaces the organization has, whoever may see them. The Connect page derives "this
 * organization is new" from it (nothing is stored), so a member who can see none of an organization's
 * workspaces still does not get told that it is empty.
 */
export const countOrganizationWorkspaces = async (organizationId: string): Promise<number> => {
  validateInputs([organizationId, ZId]);
  return prisma.workspace.count({ where: { organizationId } });
};
