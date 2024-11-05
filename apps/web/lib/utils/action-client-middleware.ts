import { isProductPartOfOrganization, isTeamPartOfOrganization } from "@/lib/utils/services";
import { getProductPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { TTeamPermission } from "@/modules/ee/teams/product-teams/types/teams";
import { TTeamRole } from "@/modules/ee/teams/team-list/types/teams";
import { returnValidationErrors } from "next-safe-action";
import { z } from "zod";
import { getOperationPermissions, getRoleBasedSchema } from "@formbricks/lib/actionClient/utils";
import { getMembershipRole } from "@formbricks/lib/membership/hooks/actions";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { TOperation, TResource } from "@formbricks/types/action-client";
import { AuthorizationError } from "@formbricks/types/errors";

export type TAccess<T extends z.ZodRawShape> =
  | {
      type: "organization";
      schema?: z.ZodObject<T>;
      data?: z.ZodObject<T>["_output"];
      rules: [TResource, TOperation];
    }
  | {
      type: "product";
      minPermission?: TTeamPermission;
      productId: string;
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
  const { isOwner, isManager } = getAccessFlags(role);

  let isAccessGranted: boolean = false;

  for (let accessItem of access) {
    if (accessItem.type === "organization") {
      if (accessItem.schema) {
        const resultSchema = getRoleBasedSchema(accessItem.schema, role, ...accessItem.rules);
        const parsedResult = resultSchema.safeParse(accessItem.data);
        if (!parsedResult.success) {
          // @ts-expect-error -- TODO: match dynamic next-safe-action types
          return returnValidationErrors(resultSchema, formatErrors(parsedResult.error.issues));
        } else {
          isAccessGranted = true;
        }
      } else {
        isAccessGranted = getOperationPermissions(role, ...accessItem.rules);
      }
    } else {
      if (isOwner || isManager) {
        if (accessItem.type === "product") {
          return await isProductPartOfOrganization(organizationId, accessItem.productId);
        } else if (accessItem.type === "team") {
          return await isTeamPartOfOrganization(organizationId, accessItem.teamId);
        }
      }

      if (accessItem.type === "product") {
        const productPermission = await getProductPermissionByUserId(userId, accessItem.productId);
        if (!productPermission) {
          isAccessGranted = false;
          continue;
        }

        if (accessItem.minPermission !== undefined) {
          const requiredPermission = teamPermissionWeight[accessItem.minPermission];

          if (teamPermissionWeight[productPermission] < requiredPermission) {
            isAccessGranted = false;
            continue;
          }
        }
      } else {
        // const teamRole = await getTeamRoleByTeamIdUserId(accessItem.teamId, userId);
        const teamRole = "admin";
        if (!teamRole) {
          isAccessGranted = false;
          continue;
        }

        if (accessItem.minPermission !== undefined) {
          const requiredRole = teamRoleWeight[accessItem.minPermission];

          if (teamRoleWeight[teamRole] < requiredRole) {
            isAccessGranted = false;
            continue;
          }
        }
      }
    }
  }

  if (!isAccessGranted) {
    throw new AuthorizationError("Not authorized");
  }
};
