import { getMembershipRole } from "@/lib/membership/hooks/actions";
import { getProjectPermissionByUserId, getTeamRoleByTeamIdUserId } from "@/modules/ee/teams/lib/roles";
import { type TTeamPermission } from "@/modules/ee/teams/project-teams/types/team";
import { type TTeamRole } from "@/modules/ee/teams/team-list/types/team";
import { returnValidationErrors } from "next-safe-action";
import { ZodIssue, z } from "zod";
import { AuthorizationError } from "@formbricks/types/errors";
import { type TOrganizationRole } from "@formbricks/types/memberships";

export const formatErrors = (issues: ZodIssue[]): Record<string, { _errors: string[] }> => {
  return {
    ...issues.reduce((acc, issue) => {
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
      type: "projectTeam";
      minPermission?: TTeamPermission;
      projectId: string;
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

const checkProjectTeamAccess = async (accessItem: any, userId: string) => {
  if (accessItem.type !== "projectTeam") return false;
  const projectPermission = await getProjectPermissionByUserId(userId, accessItem.projectId);
  if (!projectPermission) return false;
  if (
    accessItem.minPermission !== undefined &&
    teamPermissionWeight[projectPermission] < teamPermissionWeight[accessItem.minPermission]
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
    teamRoleWeight[teamRole] < teamRoleWeight[accessItem.minPermission]
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

    if (accessItem.type === "projectTeam" && (await checkProjectTeamAccess(accessItem, userId))) {
      return true;
    }

    if (accessItem.type === "team" && (await checkTeamAccess(accessItem, userId))) {
      return true;
    }
  }

  throw new AuthorizationError("Not authorized");
};
