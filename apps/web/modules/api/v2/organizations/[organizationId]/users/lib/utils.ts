import { prisma } from "@formbricks/database";
import { OrganizationRole, Prisma } from "@formbricks/database/prisma";
import { OperationNotAllowedError, ValidationError } from "@formbricks/types/errors";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { USER_MANAGEMENT_MINIMUM_ROLE } from "@/lib/constants";
import { getUserManagementAccess } from "@/lib/membership/utils";
import { buildCommonFilterQuery, pickCommonFilter } from "@/modules/api/v2/management/lib/utils";
import { TGetUsersFilter } from "@/modules/api/v2/organizations/[organizationId]/users/types/users";
import { assertCanAssignRole } from "@/modules/ee/role-management/lib/permission";

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
 * Whether the API key's creator may give `targetRole` (to a member whose role is now `targetCurrentRole`),
 * by the app's one role rule (`assertCanAssignRole`, C10) on the management API path: an owner gives
 * Member, Manager or Owner, a manager gives Member and never touches an owner, anyone else gives nothing,
 * and this API never gives the Dashboard viewer (ADR-0023) or, off Cloud, Billing. This prevents
 * privilege escalation (e.g. a manager promoting a user to owner) through the management API.
 */
export const mayAssignOrganizationRole = async (
  organizationId: string,
  assignerRole: TOrganizationRole | null,
  targetRole: TOrganizationRole,
  targetCurrentRole?: TOrganizationRole | null
): Promise<boolean> => {
  try {
    await assertCanAssignRole({
      organizationId,
      assignerRole,
      roles: [targetRole],
      targetCurrentRole,
      channel: "managementApi",
    });
    return true;
  } catch (error) {
    if (error instanceof OperationNotAllowedError || error instanceof ValidationError) return false;
    throw error;
  }
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

/**
 * Whether the acting user (the API key creator) clears the org's user-management floor. The v2 API
 * anchors this to the key creator's role so the `USER_MANAGEMENT_MINIMUM_ROLE` policy the
 * settings/session path enforces (via `getUserManagementAccess`) is applied consistently here — an
 * install that restricts user management to owners only, or disables it, isn't silently bypassed by
 * a manager-created key. An unresolved creator (null) never clears the floor.
 */
export const canManageOrganizationUsers = (assignerRole: TOrganizationRole | null): boolean => {
  if (!assignerRole) return false;
  return getUserManagementAccess(assignerRole, USER_MANAGEMENT_MINIMUM_ROLE);
};
