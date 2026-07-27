import "server-only";
import { returnValidationErrors } from "next-safe-action";
import { ZodIssue, z } from "zod";
import { AuthorizationError } from "@formbricks/types/errors";
import { type TOrganizationRole } from "@formbricks/types/memberships";
import { type TAuthorizationAction, can } from "@/lib/authorization";
import { getWorkspaceActionForPermission } from "@/lib/authorization/compatibility";
import { getMembershipRole } from "@/lib/membership/hooks/actions";
import { getTeamRoleByTeamIdUserId, getWorkspacePermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { type TTeamRole } from "@/modules/ee/teams/team-list/types/team";
import { type TTeamPermission } from "@/modules/ee/teams/workspace-teams/types/team";

export const formatErrors = (issues: ZodIssue[]): Record<string, { _errors: string[] }> => {
  return {
    ...issues.reduce<Record<string, { _errors: string[] }>>((acc, issue) => {
      acc[issue.path.join(".")] = {
        _errors: [issue.message],
      };
      return acc;
    }, {}),
  };
};

export type TAccess<T extends z.ZodRawShape> =
  | {
      type: "organization";
      schema?: z.ZodObject<T>;
      data?: z.ZodObject<T>["_output"];
      roles: TOrganizationRole[];
    }
  | {
      type: "workspaceTeam";
      minPermission?: TTeamPermission;
      workspaceId: string;
    }
  | {
      type: "team";
      minPermission?: TTeamRole;
      teamId: string;
    };

const teamPermissionWeight = {
  read: 1,
  readWrite: 2,
  manage: 3,
};

const teamRoleWeight = {
  contributor: 1,
  admin: 2,
};

type TOrganizationAction = Extract<TAuthorizationAction, `organization.${string}`>;
type TTeamAction = Extract<TAuthorizationAction, `team.${string}`>;

const ORGANIZATION_ACTION_BY_ROLE_SET: Readonly<Record<string, TOrganizationAction>> = {
  "billing,manager,member,owner": "organization.read",
  "manager,member,owner": "organization.read_access",
  "billing,manager,owner": "organization.manage_billing",
  "manager,owner": "organization.manage",
  owner: "organization.write",
};

const getOrganizationAction = (roles: TOrganizationRole[]): TOrganizationAction | null => {
  const roleSet = [...new Set(roles)].sort().join(",");
  return ORGANIZATION_ACTION_BY_ROLE_SET[roleSet] ?? null;
};

const getTeamAction = (minPermission?: TTeamRole): TTeamAction | null =>
  minPermission === "admin" ? "team.manage" : null;

const getOrganizationValidationError = <T extends z.ZodRawShape>(accessItem: TAccess<T>) => {
  if (accessItem.type !== "organization" || !accessItem.schema) return null;

  const resultSchema = accessItem.schema.strict();
  const parsedResult = resultSchema.safeParse(accessItem.data);
  if (parsedResult.success) return null;

  // @ts-expect-error -- match dynamic next-safe-action types
  return returnValidationErrors(resultSchema, formatErrors(parsedResult.error.issues));
};

const checkOrganizationAccess = <T extends z.ZodRawShape>(
  accessItem: TAccess<T>,
  role: TOrganizationRole
) => {
  if (accessItem.type !== "organization") return false;

  const validationError = getOrganizationValidationError(accessItem);
  if (validationError) return validationError;

  return accessItem.roles.includes(role);
};

const checkWorkspaceTeamAccess = async <T extends z.ZodRawShape>(accessItem: TAccess<T>, userId: string) => {
  if (accessItem.type !== "workspaceTeam") return false;
  const workspacePermission = await getWorkspacePermissionByUserId(userId, accessItem.workspaceId);
  if (!workspacePermission) return false;
  if (
    accessItem.minPermission !== undefined &&
    teamPermissionWeight[workspacePermission as keyof typeof teamPermissionWeight] <
      teamPermissionWeight[accessItem.minPermission as keyof typeof teamPermissionWeight]
  ) {
    return false;
  }
  return true;
};

const checkTeamAccess = async <T extends z.ZodRawShape>(accessItem: TAccess<T>, userId: string) => {
  if (accessItem.type !== "team") return false;
  const teamRole = await getTeamRoleByTeamIdUserId(accessItem.teamId, userId);
  if (!teamRole) return false;
  if (
    accessItem.minPermission !== undefined &&
    teamRoleWeight[teamRole as keyof typeof teamRoleWeight] <
      teamRoleWeight[accessItem.minPermission as keyof typeof teamRoleWeight]
  ) {
    return false;
  }
  return true;
};

const isCentralCompatibilityShape = <T extends z.ZodRawShape>(access: TAccess<T>[]): boolean => {
  const includesOrganizationAccess = access.some((accessItem) => accessItem.type === "organization");
  if (!includesOrganizationAccess) return false;

  return access.every((accessItem) => {
    if (accessItem.type === "organization") return getOrganizationAction(accessItem.roles) !== null;
    if (accessItem.type === "workspaceTeam") return true;
    return getTeamAction(accessItem.minPermission) !== null;
  });
};

const checkLegacyAuthorization = async <T extends z.ZodRawShape>({
  userId,
  organizationId,
  access,
}: {
  userId: string;
  organizationId: string;
  access: TAccess<T>[];
}) => {
  const role = await getMembershipRole(userId, organizationId);

  for (const accessItem of access) {
    if (accessItem.type === "organization") {
      const orgResult = checkOrganizationAccess(accessItem, role);
      if (orgResult === true) return true;
      if (orgResult) return orgResult;
    }

    if (accessItem.type === "workspaceTeam" && (await checkWorkspaceTeamAccess(accessItem, userId))) {
      return true;
    }

    if (accessItem.type === "team" && (await checkTeamAccess(accessItem, userId))) {
      return true;
    }
  }

  throw new AuthorizationError("Not authorized");
};

/**
 * Compatibility adapter for the pre-ENG-1712 action-client authorization signature.
 *
 * @deprecated New code must call `can` or `assertCan` with a semantic action and
 * resource. Unrecognized legacy shapes remain supported only until ENG-1737.
 */
export const checkAuthorizationUpdated = async <T extends z.ZodRawShape>({
  userId,
  organizationId,
  access,
}: {
  userId: string;
  organizationId: string;
  access: TAccess<T>[];
}) => {
  if (!isCentralCompatibilityShape(access)) {
    return checkLegacyAuthorization({ userId, organizationId, access });
  }

  const actor = { type: "user", id: userId } as const;
  const organization = { type: "organization", id: organizationId } as const;
  const isOrganizationMember = await can(actor, "organization.read", organization);

  if (!isOrganizationMember) {
    throw new AuthorizationError("Not authorized");
  }

  for (const accessItem of access) {
    if (accessItem.type === "organization") {
      const validationError = getOrganizationValidationError(accessItem);
      if (validationError) return validationError;

      const action = getOrganizationAction(accessItem.roles);
      if (action && (await can(actor, action, organization))) return true;
    }

    if (accessItem.type === "workspaceTeam") {
      const action = getWorkspaceActionForPermission(accessItem.minPermission);
      if (await can(actor, action, { type: "workspace", id: accessItem.workspaceId })) return true;
    }

    if (accessItem.type === "team") {
      const action = getTeamAction(accessItem.minPermission);
      if (action && (await can(actor, action, { type: "team", id: accessItem.teamId }))) return true;
    }
  }

  throw new AuthorizationError("Not authorized");
};
