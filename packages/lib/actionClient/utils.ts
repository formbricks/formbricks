import { ZodIssue, z } from "zod";
import { TOperation, TResource } from "@formbricks/types/action-client";
import { AuthorizationError } from "@formbricks/types/errors";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { Permissions } from "./permissions";

export const getOperationPermissions = (
  role: TOrganizationRole,
  entity: TResource,
  operation: TOperation
) => {
  const permission = Permissions[role][entity][operation];

  if (typeof permission === "boolean" && !permission) {
    throw new AuthorizationError("Not authorized");
  }

  return permission;
};

export const getRoleBasedSchema = <T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  role: TOrganizationRole,
  entity: TResource,
  operation: TOperation
): z.ZodObject<T> => {
  const data = getOperationPermissions(role, entity, operation);

  return typeof data === "boolean" && data === true ? schema.strict() : data;
};

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
