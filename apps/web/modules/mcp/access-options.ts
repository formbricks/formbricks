import "server-only";
import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";
import { lookupAuthorizedWorkspaceIds } from "@/lib/authorization/resource-list";
import type { TMcpGrantAccessSelection } from "./grant";
import { type TMcpGrantAccessOptions, getMcpGrantSelectedIds } from "./grant-access";

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

type TSelectionReader = {
  membership: Pick<Prisma.TransactionClient["membership"], "findMany">;
  workspace: Pick<Prisma.TransactionClient["workspace"], "findMany">;
};

/**
 * The SpiceDB half of {@link keepOfferedMcpGrantSelection}: the workspaces SpiceDB lets the user read
 * (`dashboard_read`, as the picker offers them), when `selection` selects workspaces; empty otherwise,
 * without a call. A save reads it BEFORE its transaction locks the grant row, so no SpiceDB lookup holds
 * a row lock or a pooled connection. The transaction then checks the rest with PostgreSQL alone.
 */
export const readMcpGrantReadableWorkspaceIds = async (
  userId: string,
  selection: TMcpGrantAccessSelection | null | undefined
): Promise<ReadonlySet<string>> =>
  selection?.access === "workspaces"
    ? new Set(await lookupAuthorizedWorkspaceIds({ type: "user", id: userId }, "dashboard_read"))
    : new Set();

/**
 * The part of `selection` the picker would offer the user now, by {@link listMcpGrantAccessOptions}'s
 * rule: organizations they belong to other than as a billing member, and workspaces SpiceDB lets them read
 * (`readableWorkspaceIds`, from {@link readMcpGrantReadableWorkspaceIds}) in those organizations. Reads ids
 * only, only the ids `selection` names, and only from PostgreSQL. Takes the caller's transaction, so a save
 * checks the user's memberships in the transaction that saves it.
 */
export const keepOfferedMcpGrantSelection = async (
  db: TSelectionReader,
  userId: string,
  selection: TMcpGrantAccessSelection,
  readableWorkspaceIds: ReadonlySet<string>
): Promise<TMcpGrantAccessSelection> => {
  switch (selection.access) {
    case "all":
      return selection;
    case "organizations": {
      const memberships = await db.membership.findMany({
        where: { userId, role: { not: "billing" }, organizationId: { in: selection.organizationIds } },
        select: { organizationId: true },
      });
      const offered = new Set(memberships.map(({ organizationId }) => organizationId));
      return {
        access: "organizations",
        organizationIds: selection.organizationIds.filter((id) => offered.has(id)),
      };
    }
    case "workspaces": {
      const candidates = selection.workspaceIds.filter((id) => readableWorkspaceIds.has(id));
      const workspaces =
        candidates.length === 0
          ? []
          : await db.workspace.findMany({
              where: {
                id: { in: candidates },
                organization: { memberships: { some: { userId, role: { not: "billing" } } } },
              },
              select: { id: true },
            });
      const offered = new Set(workspaces.map(({ id }) => id));
      return { access: "workspaces", workspaceIds: selection.workspaceIds.filter((id) => offered.has(id)) };
    }
  }
};

/** The outcome of {@link resolveMcpGrantSelection}: the selection to save, or the field to refuse. */
export type TMcpGrantSelectionResolution =
  | { status: "ok"; access: TMcpGrantAccessSelection }
  | { status: "unavailable"; field: "organizationIds" | "workspaceIds" };

/**
 * The one rule for what a consent approval and Authorized apps' Edit may save as a grant's organization &
 * workspace access (spec story 36). An id the request adds must be one the picker offers the user now
 * ({@link keepOfferedMcpGrantSelection}), or the request is refused, naming the field. An id the grant
 * already selects and the user has since lost (team access removed, organization now held only as a
 * billing member) is dropped without a refusal: the picker no longer shows it, so the user could not have
 * kept it on purpose, and keeping it would refuse even a permissions-only save.
 *
 * Reads PostgreSQL only: `readableWorkspaceIds` is {@link readMcpGrantReadableWorkspaceIds}'s answer for
 * `requested`, read before the caller's transaction locked anything.
 */
export const resolveMcpGrantSelection = async (
  db: TSelectionReader,
  userId: string,
  requested: TMcpGrantAccessSelection,
  stored: TMcpGrantAccessSelection | null,
  readableWorkspaceIds: ReadonlySet<string>
): Promise<TMcpGrantSelectionResolution> => {
  if (requested.access === "all") return { status: "ok", access: requested };
  const field = requested.access === "organizations" ? "organizationIds" : "workspaceIds";
  const offered = await keepOfferedMcpGrantSelection(db, userId, requested, readableWorkspaceIds);
  const kept = new Set(getMcpGrantSelectedIds(offered)[field]);
  const already = new Set(stored ? getMcpGrantSelectedIds(stored)[field] : []);
  const added = getMcpGrantSelectedIds(requested)[field].filter((id) => !already.has(id));
  if (added.some((id) => !kept.has(id))) return { status: "unavailable", field };
  return { status: "ok", access: offered };
};
