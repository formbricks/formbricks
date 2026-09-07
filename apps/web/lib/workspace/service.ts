import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { ZId, ZOptionalNumber, ZString } from "@formbricks/types/common";
import { DatabaseError, ValidationError } from "@formbricks/types/errors";
import type { TWorkspace } from "@formbricks/types/workspace";
import {
  lookupAuthorizedOrganizationIds,
  lookupAuthorizedWorkspaceIds,
} from "@/lib/authorization/resource-list";
import { ITEMS_PER_PAGE } from "../constants";
import { normalizeEmailForComparison } from "../utils/email";
import { validateInputs } from "../utils/validate";

const selectWorkspace = {
  id: true,
  createdAt: true,
  updatedAt: true,
  legacyEnvironmentId: true,
  name: true,
  organizationId: true,
  languages: true,
  recontactDays: true,
  linkSurveyBranding: true,
  inAppSurveyBranding: true,
  config: true,
  placement: true,
  clickOutsideClose: true,
  overlay: true,
  appSetupCompleted: true,
  styling: true,
  logo: true,
  customHeadScripts: true,
};

export const getUserWorkspaces = reactCache(
  async (userId: string, organizationId: string, page?: number): Promise<TWorkspace[]> => {
    validateInputs([userId, ZString], [organizationId, ZId], [page, ZOptionalNumber]);

    const actor = { type: "user", id: userId } as const;
    const [authorizedOrganizationIds, authorizedWorkspaceIds] = await Promise.all([
      lookupAuthorizedOrganizationIds(actor),
      lookupAuthorizedWorkspaceIds(actor),
    ]);

    if (!authorizedOrganizationIds.includes(organizationId)) {
      throw new ValidationError("User is not a member of this organization");
    }

    try {
      const workspaces = await prisma.workspace.findMany({
        where: {
          id: { in: [...authorizedWorkspaceIds] },
          organizationId,
        },
        select: selectWorkspace,
        take: page ? ITEMS_PER_PAGE : undefined,
        skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
      });
      return workspaces;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);

export const getWorkspaces = reactCache(
  async (organizationId: string, page?: number): Promise<TWorkspace[]> => {
    validateInputs([organizationId, ZId], [page, ZOptionalNumber]);

    try {
      const workspaces = await prisma.workspace.findMany({
        where: {
          organizationId,
        },
        select: selectWorkspace,
        take: page ? ITEMS_PER_PAGE : undefined,
        skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
      });
      return workspaces;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);

/**
 * Return only the requested workspaces that belong to the supplied organization.
 *
 * Authorization-sensitive callers must scope the database read itself instead of fetching by ID and
 * discarding foreign-organization rows afterwards.
 */
export const getWorkspacesByIds = reactCache(
  async (organizationId: string, workspaceIds: string[]): Promise<TWorkspace[]> => {
    validateInputs([organizationId, ZId], [workspaceIds, ZId.array()]);

    if (workspaceIds.length === 0) return [];

    try {
      return await prisma.workspace.findMany({
        where: {
          id: { in: workspaceIds },
          organizationId,
        },
        select: selectWorkspace,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);

/**
 * Resolve authoritative workspace lookup results for a user through their current organization
 * memberships. The ID allowlist comes from SpiceDB; this query only verifies existence and tenant
 * membership before returning application data, and never re-evaluates roles or team grants.
 */
export const getOrganizationScopedWorkspacesByIdsForUser = reactCache(
  async (userId: string, workspaceIds: string[]): Promise<TWorkspace[]> => {
    validateInputs([userId, ZId], [workspaceIds, ZId.array()]);
    if (workspaceIds.length === 0) return [];

    try {
      return await prisma.workspace.findMany({
        where: {
          id: { in: workspaceIds },
          organization: { memberships: { some: { userId } } },
        },
        select: selectWorkspace,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);

export const getWorkspace = reactCache(async (workspaceId: string): Promise<TWorkspace | null> => {
  let workspacePrisma;
  try {
    workspacePrisma = await prisma.workspace.findUnique({
      where: {
        id: workspaceId,
      },
      select: selectWorkspace,
    });

    return workspacePrisma;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
});

// Storage prefixes a workspace owns for pre-#8044 file URLs: its own id and, when present, the
// environment id it was migrated from (old storage was keyed by environment id, mirrored by
// `legacyEnvironmentId ?? workspaceId`). The management routes pass these to validateClientFileUploads
// so a replayed legacy response validates without reopening cross-tenant deletion. See ENG-1981.
export const getWorkspaceLegacyStoragePrefixes = reactCache(
  async (workspaceId: string): Promise<string[]> => {
    validateInputs([workspaceId, ZId]);

    try {
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true, legacyEnvironmentId: true },
      });

      if (!workspace) return [];

      return [workspace.id, workspace.legacyEnvironmentId].filter((prefix): prefix is string =>
        Boolean(prefix)
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

/** A member who can access a workspace, as the `send_email` recipient picker needs them. */
export interface TWorkspaceMember {
  name: string;
  email: string;
}

/**
 * Everyone who can access a workspace, name included. The single source of truth the `send_email`
 * recipient picker offers options from, so the authoring UI cannot offer an address that the
 * enable-time gate and the runner backstop would then reject (ENG-2186).
 *
 * "Can access" mirrors the central `workspace.read` authorization enforced by
 * `requireSessionWorkspaceAccess`: an organization owner/manager reaches every workspace in the
 * organization, and every other role reaches a workspace only through a team linked to it — at any
 * `WorkspaceTeam` permission, since `read` already grants access.
 *
 * The organization is resolved from the workspace itself rather than taken from the caller, so the
 * tenant boundary cannot be widened by passing a foreign organization id. Deactivated (soft-deleted)
 * users are excluded: their access has been revoked.
 */
export const getWorkspaceMembers = reactCache(async (workspaceId: string): Promise<TWorkspaceMember[]> => {
  validateInputs([workspaceId, ZId]);

  try {
    const memberships = await prisma.membership.findMany({
      where: {
        organization: { workspaces: { some: { id: workspaceId } } },
        user: { isActive: true },
        OR: [
          { role: { in: ["owner", "manager"] } },
          { user: { teamUsers: { some: { team: { workspaceTeams: { some: { workspaceId } } } } } } },
        ],
      },
      select: { user: { select: { name: true, email: true } } },
    });

    return memberships.map((membership) => membership.user).filter((user) => user.email.length > 0);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
});

/**
 * Lowercased set of the email addresses of everyone who can access a workspace. Used as the
 * recipient allowlist for workflow `send_email` actions: a literal recipient address is only
 * permitted when its owner can access the workspace whose response data the email carries, so a
 * workflow can neither forward that data to an arbitrary external inbox (ENG-2029) nor keep
 * emailing a member whose access to this workspace was revoked (ENG-2186). Emails are normalized
 * for case-insensitive matching.
 */
export const getWorkspaceMemberEmails = reactCache(async (workspaceId: string): Promise<Set<string>> => {
  const members = await getWorkspaceMembers(workspaceId);
  return new Set(members.map((member) => normalizeEmailForComparison(member.email)));
});

export const getOrganizationWorkspacesCount = reactCache(async (organizationId: string): Promise<number> => {
  validateInputs([organizationId, ZId]);

  try {
    const workspaces = await prisma.workspace.count({
      where: {
        organizationId,
      },
    });
    return workspaces;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
});

export const getUserWorkspacesByOrganizationIds = reactCache(
  async (organizationIds: string[], userId: string): Promise<Pick<TWorkspace, "id">[]> => {
    validateInputs([organizationIds, ZId.array()], [userId, ZId]);
    try {
      if (organizationIds.length === 0) {
        return [];
      }

      const workspaceIds = await lookupAuthorizedWorkspaceIds({ type: "user", id: userId });
      if (workspaceIds.length === 0) return [];

      const workspaces = await prisma.workspace.findMany({
        where: {
          id: { in: [...workspaceIds] },
          organizationId: { in: organizationIds },
        },
        select: { id: true },
      });

      return workspaces;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(err.message);
      }

      throw err;
    }
  }
);
