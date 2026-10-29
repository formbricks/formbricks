import "server-only";
import { prisma } from "@formbricks/database";
import type { TOrganizationRole } from "@formbricks/types/memberships";

/**
 * Organization role of each given user, for those who are members of the organization. A user missing from
 * the result is not a member, which is how `update_team` refuses a person from outside the organization.
 */
export async function getOrganizationRoles(
  organizationId: string,
  userIds: readonly string[]
): Promise<Map<string, TOrganizationRole>> {
  if (userIds.length === 0) return new Map();

  const memberships = await prisma.membership.findMany({
    where: { organizationId, userId: { in: [...userIds] } },
    select: { userId: true, role: true },
  });
  return new Map(memberships.map(({ userId, role }) => [userId, role]));
}

/** How many of the given workspace ids belong to the organization. */
export async function countOrganizationWorkspaces(
  organizationId: string,
  workspaceIds: readonly string[]
): Promise<number> {
  if (workspaceIds.length === 0) return 0;

  return prisma.workspace.count({ where: { organizationId, id: { in: [...workspaceIds] } } });
}

/** True when another team of the organization already has this name. */
export async function isTeamNameTaken(
  organizationId: string,
  name: string,
  exceptTeamId?: string
): Promise<boolean> {
  const taken = await prisma.team.findFirst({
    where: { organizationId, name, ...(exceptTeamId ? { id: { not: exceptTeamId } } : {}) },
    select: { id: true },
  });
  return taken !== null;
}

export async function countOrganizationTeams(organizationId: string): Promise<number> {
  return prisma.team.count({ where: { organizationId } });
}
