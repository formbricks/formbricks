import { returnValidationErrors } from "next-safe-action";
import { ZodIssue, z } from "zod";
import { AuthorizationError } from "@formbricks/types/errors";
import { type TOrganizationRole } from "@formbricks/types/memberships";
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

const checkOrganizationAccess = <T extends z.ZodRawShape>(
  accessItem: TAccess<T>,
  role: TOrganizationRole
) => {
  if (accessItem.type !== "organization") return false;
  if (accessItem.schema) {
    const resultSchema = accessItem.schema.strict();
    const parsedResult = resultSchema.safeParse(accessItem.data);
    if (!parsedResult.success) {
      // @ts-expect-error -- match dynamic next-safe-action types
      return returnValidationErrors(resultSchema, formatErrors(parsedResult.error.issues));
    }
  }
  return accessItem.roles.includes(role);
};

const checkWorkspaceTeamAccess = async (accessItem: any, userId: string) => {
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

const checkTeamAccess = async (accessItem: any, userId: string) => {
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

export const checkAuthorizationUpdated = async <T extends z.ZodRawShape>({
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
      if (orgResult) return orgResult; // validation error
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
