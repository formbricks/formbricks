import { ResourceNotFoundError } from "@formbricks/types/errors";
import { getEnvironment } from "../environment/service";
import { getPerson } from "../person/service";
import { getProduct } from "../product/service";
import { getResponse } from "../response/service";
import { getSurvey } from "../survey/service";

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
