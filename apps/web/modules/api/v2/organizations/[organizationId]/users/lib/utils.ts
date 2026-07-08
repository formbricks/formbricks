import { prisma } from "@formbricks/database";
import { OrganizationRole, Prisma } from "@formbricks/database/prisma";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { buildCommonFilterQuery, pickCommonFilter } from "@/modules/api/v2/management/lib/utils";
import { TGetUsersFilter } from "@/modules/api/v2/organizations/[organizationId]/users/types/users";

export const getUsersQuery = (organizationId: string, params?: TGetUsersFilter) => {
  let query: Prisma.UserFindManyArgs = {
    where: {
      memberships: {
        some: {
          organizationId,
        },
      },
    },
  };

  if (!params) return query;

  if (params.email) {
    query.where = {
      ...query.where,
      email: {
        contains: params.email,
        mode: "insensitive",
      },
    };
  }

  if (params.id) {
    query.where = {
      ...query.where,
      id: params.id,
    };
  }

  const baseFilter = pickCommonFilter(params);

  if (baseFilter) {
    query = buildCommonFilterQuery<Prisma.UserFindManyArgs>(query, baseFilter);
  }

  return query;
};

/**
 * Resolves the organization role of the user who created the API key.
 *
 * Org-scoped API keys carry only read/write/manage access flags, not a role, so role-based
 * authorization has to be anchored to the acting user — the key's creator. Returns null when the
 * creator can't be resolved (a legacy key with no `createdBy`, a deleted creator, or a creator who
 * is no longer a member of the organization) so callers fail safe.
 */
export const getApiKeyCreatorRole = async (
  apiKeyId: string,
  organizationId: string
): Promise<TOrganizationRole | null> => {
  const apiKey = await prisma.apiKey.findUnique({
    where: { id: apiKeyId },
    select: { createdBy: true },
  });

  if (!apiKey?.createdBy) return null;

  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: apiKey.createdBy,
        organizationId,
      },
    },
    select: { role: true },
  });

  return membership?.role ?? null;
};

/**
 * Resolves the target user's current role in the organization by email. Returns null when the
 * user doesn't exist or has no membership in the organization.
 */
export const getMembershipRoleByEmail = async (
  email: string,
  organizationId: string
): Promise<TOrganizationRole | null> => {
  const membership = await prisma.membership.findFirst({
    where: {
      organizationId,
      user: { email },
    },
    select: { role: true },
  });

  return membership?.role ?? null;
};

/**
 * Mirrors the role clamp enforced on the settings/session path
 * (modules/ee/role-management/actions.ts): an owner may assign any role, a manager may only assign
 * the member role and may not change the role of an existing owner (no demoting owners). Anyone
 * else — including an unresolved creator — may not assign a role at all. This prevents privilege
 * escalation (e.g. a manager promoting a user to owner) through the management API, matching the
 * guard that the UI already applies.
 */
export const canAssignOrganizationRole = (
  assignerRole: TOrganizationRole | null,
  targetRole: TOrganizationRole,
  targetCurrentRole?: TOrganizationRole | null
): boolean => {
  if (assignerRole === OrganizationRole.owner) return true;
  if (targetCurrentRole === OrganizationRole.owner) return false;
  if (assignerRole === OrganizationRole.manager) return targetRole === OrganizationRole.member;
  return false;
};

/**
 * Whether the acting user (the API key creator) may modify the target membership at all. Only an
 * owner may act on an existing owner: this guards not just the role, but every other membership
 * field an update can touch (active state, email, teams). Without it a manager-scoped key could,
 * for example, deactivate or lock out an owner even though it can't change their role.
 */
export const canModifyOrganizationMember = (
  assignerRole: TOrganizationRole | null,
  targetCurrentRole: TOrganizationRole | null
): boolean => {
  if (assignerRole === OrganizationRole.owner) return true;
  return targetCurrentRole !== OrganizationRole.owner;
};
