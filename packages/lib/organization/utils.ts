import { ResourceNotFoundError } from "@formbricks/types/errors";
import { getActionClass } from "../actionClass/service";
import { getApiKey } from "../apiKey/service";
import { getAttributeClass } from "../attributeClass/service";
import { getEnvironment } from "../environment/service";
import { getIntegration } from "../integration/service";
import { getInvite } from "../invite/service";
import { getLanguage } from "../language/service";
import { getPerson } from "../person/service";
import { getProduct } from "../product/service";
import { getResponse } from "../response/service";
import { getResponseNote } from "../responseNote/service";
import { getSegment } from "../segment/service";
import { getSurvey } from "../survey/service";
import { getTag } from "../tag/service";
import { getWebhook } from "../webhook/service";

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

  return await getOrganizationIdFromProductId(environment.productId);
};

export const getOrganizationIdFromSurveyId = async (surveyId: string) => {
  const survey = await getSurvey(surveyId);
  if (!survey) {
    throw new ResourceNotFoundError("survey", surveyId);
  }

  return await getOrganizationIdFromEnvironmentId(survey.environmentId);
};

export const getOrganizationIdFromResponseId = async (responseId: string) => {
  const response = await getResponse(responseId);
  if (!response) {
    throw new ResourceNotFoundError("response", responseId);
  }

  return await getOrganizationIdFromSurveyId(response.surveyId);
};

export const getOrganizationIdFromPersonId = async (personId: string) => {
  const person = await getPerson(personId);
  if (!person) {
    throw new ResourceNotFoundError("person", personId);
  }

  return await getOrganizationIdFromEnvironmentId(person.environmentId);
};

export const getOrganizationIdFromTagId = async (tagId: string) => {
  const tag = await getTag(tagId);
  if (!tag) {
    throw new ResourceNotFoundError("tag", tagId);
  }

  return await getOrganizationIdFromEnvironmentId(tag.environmentId);
};

export const getOrganizationIdFromResponseNoteId = async (responseNoteId: string) => {
  const responseNote = await getResponseNote(responseNoteId);
  if (!responseNote) {
    throw new ResourceNotFoundError("responseNote", responseNoteId);
  }

  return await getOrganizationIdFromResponseId(responseNote.responseId);
};

export const getOrganizationIdFromAttributeClassId = async (attributeClassId: string) => {
  const attributeClass = await getAttributeClass(attributeClassId);
  if (!attributeClass) {
    throw new ResourceNotFoundError("attributeClass", attributeClassId);
  }

  return await getOrganizationIdFromEnvironmentId(attributeClass.environmentId);
};

export const getOrganizationIdFromSegmentId = async (segmentId: string) => {
  const segment = await getSegment(segmentId);
  if (!segment) {
    throw new ResourceNotFoundError("segment", segmentId);
  }

  return await getOrganizationIdFromEnvironmentId(segment.environmentId);
};

export const getOrganizationIdFromActionClassId = async (actionClassId: string) => {
  const actionClass = await getActionClass(actionClassId);
  if (!actionClass) {
    throw new ResourceNotFoundError("actionClass", actionClassId);
  }

  return await getOrganizationIdFromEnvironmentId(actionClass.environmentId);
};

export const getOrganizationIdFromIntegrationId = async (integrationId: string) => {
  const integration = await getIntegration(integrationId);
  if (!integration) {
    throw new ResourceNotFoundError("integration", integrationId);
  }

  return await getOrganizationIdFromEnvironmentId(integration.environmentId);
};

export const getOrganizationIdFromWebhookId = async (webhookId: string) => {
  const webhook = await getWebhook(webhookId);
  if (!webhook) {
    throw new ResourceNotFoundError("webhook", webhookId);
  }

  return await getOrganizationIdFromEnvironmentId(webhook.environmentId);
};

export const getOrganizationIdFromApiKeyId = async (apiKeyId: string) => {
  const apiKeyFromServer = await getApiKey(apiKeyId);
  if (!apiKeyFromServer) {
    throw new ResourceNotFoundError("apiKey", apiKeyId);
  }

  return await getOrganizationIdFromEnvironmentId(apiKeyFromServer.environmentId);
};

export const getOrganizationIdFromInviteId = async (inviteId: string) => {
  const invite = await getInvite(inviteId);
  if (!invite) {
    throw new ResourceNotFoundError("invite", inviteId);
  }

  return invite.organizationId;
};

export const getOrganizationIdFromLanguageId = async (languageId: string) => {
  const language = await getLanguage(languageId);
  if (!language) {
    throw new ResourceNotFoundError("language", languageId);
  }

  return await getOrganizationIdFromProductId(language.productId);
};
