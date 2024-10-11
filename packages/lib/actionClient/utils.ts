import { returnValidationErrors } from "next-safe-action";
import { ZodIssue, z } from "zod";
import { TOperation, TResource } from "@formbricks/types/action-client";
import { AuthorizationError } from "@formbricks/types/errors";
import { TMembershipRole } from "@formbricks/types/memberships";
import { getMembershipRole } from "../membership/hooks/actions";
import { Permissions } from "./permissions";

export const getOperationPermissions = (role: TMembershipRole, entity: TResource, operation: TOperation) => {
  const permission = Permissions[role][entity][operation];

  if (typeof permission === "boolean" && !permission) {
    throw new AuthorizationError("Not authorized");
  }

  return permission;
};

export const getRoleBasedSchema = <T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  role: TMembershipRole,
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

export const checkAuthorization = async <T extends z.ZodRawShape>({
  schema,
  data,
  userId,
  organizationId,
  rules,
}: {
  schema?: z.ZodObject<T>;
  data?: z.ZodObject<T>["_output"];
  userId: string;
  organizationId: string;
  rules: [TResource, TOperation];
}) => {
  const role = await getMembershipRole(userId, organizationId);
  if (schema) {
    const resultSchema = getRoleBasedSchema(schema, role, ...rules);
    const parsedResult = resultSchema.safeParse(data);
    if (!parsedResult.success) {
      // @ts-expect-error -- TODO: match dynamic next-safe-action types
      return returnValidationErrors(resultSchema, formatErrors(parsedResult.error.issues));
    }
  } else {
    getOperationPermissions(role, ...rules);
  }
};
