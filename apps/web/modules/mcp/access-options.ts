import "server-only";
import { prisma } from "@formbricks/database";
import { lookupAuthorizedWorkspaceIds } from "@/lib/authorization/resource-list";
import type { TMcpGrantAccessOptions } from "./grant-access";

/**
 * What the organization & workspace access picker offers a user (ENG-7153), on the consent screen and in
 * Authorized apps' Edit: the organizations they belong to, and the workspaces they can reach across them.
 * Never wider than the user: a grant reaches only what the user does anyway (ADR-0042).
 */

/**
 * Two reads whatever the count. The organizations are the user's memberships, billing-only ones aside: a
 * billing member reaches no product data, so selecting that organization would give a client nothing. The
 * workspaces are those SpiceDB lets the user read, a Dashboard viewer's dashboard workspaces included
 * (`dashboard_read` covers `read`), in those organizations.
 */
export const listMcpGrantAccessOptions = async (userId: string): Promise<TMcpGrantAccessOptions> => {
  const [memberships, workspaceIds] = await Promise.all([
    prisma.membership.findMany({
      where: { userId, role: { not: "billing" } },
      select: { organization: { select: { id: true, name: true } } },
    }),
    lookupAuthorizedWorkspaceIds({ type: "user", id: userId }, "dashboard_read"),
  ]);
  const organizations = memberships
    .map(({ organization }) => organization)
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const organizationNames = new Map(organizations.map(({ id, name }) => [id, name]));

  const workspaces =
    workspaceIds.length === 0
      ? []
      : await prisma.workspace.findMany({
          where: { id: { in: [...workspaceIds] }, organizationId: { in: [...organizationNames.keys()] } },
          select: { id: true, name: true, organizationId: true },
        });

  return {
    organizations,
    workspaces: workspaces
      .map((workspace) => ({
        ...workspace,
        organizationName: organizationNames.get(workspace.organizationId) ?? "",
      }))
      .sort(
        (a, b) =>
          a.organizationName.localeCompare(b.organizationName) ||
          a.name.localeCompare(b.name) ||
          a.id.localeCompare(b.id)
      ),
  };
};
