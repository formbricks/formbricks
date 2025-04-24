import { returnValidationErrors } from "next-safe-action";
import { ZodIssue, z } from "zod";
import { getMembershipRole } from "@formbricks/lib/membership/hooks/actions";
import { getSurvey } from "@formbricks/lib/survey/service";
import { AuthorizationError } from "@formbricks/types/errors";
import { type TOrganizationRole } from "@formbricks/types/memberships";

const formatErrors = (issues: ZodIssue[]): Record<string, { _errors: string[] }> => {
  return {
    ...issues.reduce((acc, issue) => {
      acc[issue.path.join(".")] = {
        _errors: [issue.message],
      };
      return acc;
    }, {}),
  };
};

export type TAccess<T extends z.ZodRawShape> = {
  type: "organization" | "survey";
  schema?: z.ZodObject<T>;
  data?: z.ZodObject<T>["_output"];
  roles: TOrganizationRole[];
};

export const checkAuthorizationUpdated = async <T extends z.ZodRawShape>({
  userId,
  organizationId,
  surveyId,
  access,
}: {
  userId: string;
  organizationId: string;
  access: TAccess<T>[];
  surveyId?: string;
}) => {
  const role = await getMembershipRole(userId, organizationId);

  for (const accessItem of access) {
    if (accessItem.type === "organization") {
      if (accessItem.schema) {
        const resultSchema = accessItem.schema.strict();
        const parsedResult = resultSchema.safeParse(accessItem.data);
        if (!parsedResult.success) {
          // @ts-expect-error -- TODO: match dynamic next-safe-action types
          return returnValidationErrors(resultSchema, formatErrors(parsedResult.error.issues));
        }
      }

      if (accessItem.roles.includes(role)) {
        return true;
      }
    }

    if (accessItem.type === "survey" && surveyId) {
      const survey = await getSurvey(surveyId);
      if (survey?.createdBy === userId) {
        return true;
      }
    }
  }

  throw new AuthorizationError("Not authorized");
};
