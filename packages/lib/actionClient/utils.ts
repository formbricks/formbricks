import { returnValidationErrors } from "next-safe-action";
import { getResponse } from "response/service";
import { getSurvey } from "survey/service";
import { ZodIssue, z } from "zod";
import { AuthorizationError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TMembershipRole } from "@formbricks/types/memberships";
import { getEnvironment } from "../environment/service";
import { getMembershipByUserIdOrganizationId } from "../membership/service";
import { getPerson } from "../person/service";
import { getProduct } from "../product/service";
import { TAction, TResource } from "./index";
import { Roles } from "./rulesEngine";

export const getActionPermissions = (role: TMembershipRole, entity: TResource, action: TAction) => {
  const permission = Roles[role][entity][action];

  if (typeof permission === "boolean" && !permission) {
    throw new AuthorizationError("Not authorized");
  }

  return permission;
};

export const getRoleBasedSchema = <T extends z.ZodRawShape>(
  schema: z.ZodSchema<T>,
  role: TMembershipRole,
  entity: TResource,
  action: TAction
): z.ZodObject<T> => {
  const data = getActionPermissions(role, entity, action);

  return typeof data === "boolean" && data === true ? schema : data;
};

export const getMembershipRole = async (userId: string, organizationId: string) => {
  const membership = await getMembershipByUserIdOrganizationId(userId, organizationId);
  if (!membership) {
    throw new AuthorizationError("Not authorized");
  }

  return membership.role;
};

export const formatErrors = (errors: ZodIssue[]) => {
  return {
    ...errors.reduce((acc, error) => {
      acc[error.path.join(".")] = {
        _errors: [error.message],
      };
      return acc;
    }, {}),
  };
};

export const checkAuthorization = async <T extends z.ZodRawShape>({
  zodSchema,
  data,
  userId,
  organizationId,
  rules,
}: {
  zodSchema?: z.ZodObject<T>;
  data?: z.ZodObject<T>["_output"];
  userId: string;
  organizationId: string;
  rules: [TResource, TAction];
}) => {
  const role = await getMembershipRole(userId, organizationId);
  if (zodSchema) {
    const schema = getRoleBasedSchema(zodSchema, role, ...rules);
    const parsedResult = schema.safeParse(data);
    if (!parsedResult.success) {
      return returnValidationErrors(schema, formatErrors(parsedResult.error.issues));
    }
  } else {
    getActionPermissions(role, ...rules);
  }
};

/**
 * GET organization ID from RESOURCE ID
 */

export const getOrganizationIdFromProductId = async (productId: string) => {
  const product = await getProduct(productId);
  if (!product) {
    throw new ResourceNotFoundError("product", productId);
  }

  return product.organizationId;
};

export const getOrganizationIdFromEnvironmentId = async (environmentId: string) => {
  const environment = await getEnvironment(environmentId);
  if (!environment) {
    throw new ResourceNotFoundError("environment", environmentId);
  }

  const organizationId = await getOrganizationIdFromProductId(environment.productId);
  return organizationId;
};

export const getOrganizationIdFromSurveyId = async (surveyId: string) => {
  const survey = await getSurvey(surveyId);
  if (!survey) {
    throw new ResourceNotFoundError("survey", surveyId);
  }

  const organizationId = await getOrganizationIdFromEnvironmentId(survey.environmentId);
  return organizationId;
};

export const getOrganizationIdFromResponseId = async (responseId: string) => {
  const response = await getResponse(responseId);
  if (!response) {
    throw new ResourceNotFoundError("response", responseId);
  }

  const organizationId = await getOrganizationIdFromSurveyId(response.surveyId);
  return organizationId;
};

export const getOrganizationIdFromPersonId = async (personId: string) => {
  const person = await getPerson(personId);
  if (!person) {
    throw new ResourceNotFoundError("person", personId);
  }

  const organizationId = await getOrganizationIdFromEnvironmentId(person.environmentId);
  return organizationId;
};
