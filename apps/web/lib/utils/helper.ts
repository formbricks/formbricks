import {
  getActionClass,
  getApiKey,
  getAttributeClass,
  getDocument,
  getEnvironment,
  getInsight,
  getIntegration,
  getInvite,
  getLanguage,
  getPerson,
  getProduct,
  getResponse,
  getResponseNote,
  getSegment,
  getSurvey,
  getTag,
  getTeam,
  getWebhook,
} from "@/lib/utils/services";
import { ResourceNotFoundError } from "@formbricks/types/errors";

export const getFormattedErrorMessage = (result) => {
  let message = "";

  if (result.serverError) {
    message = result.serverError;
  } else {
    const errors = result.validationErrors;
    message = Object.keys(errors || {})
      .map((key) => {
        if (key === "_errors") return errors[key].join(", ");
        return `${key ? `${key}` : ""}${errors?.[key]?._errors?.join(", ")}`;
      })
      .join("\n");
  }

  return message;
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

export const getOrganizationIdFromTeamId = async (teamId: string) => {
  const team = await getTeam(teamId);
  if (!team) {
    throw new ResourceNotFoundError("team", teamId);
  }

  return team.organizationId;
};

export const getOrganizationIdFromInsightId = async (insightId: string) => {
  const insight = await getInsight(insightId);
  if (!insight) {
    throw new ResourceNotFoundError("insight", insightId);
  }

  return await getOrganizationIdFromEnvironmentId(insight.environmentId);
};

export const getOrganizationIdFromDocumentId = async (documentId: string) => {
  const document = await getDocument(documentId);
  if (!document) {
    throw new ResourceNotFoundError("document", documentId);
  }

  return await getOrganizationIdFromEnvironmentId(document.environmentId);
};

// product id helpers
export const getProductIdFromEnvironmentId = async (environmentId: string) => {
  const environment = await getEnvironment(environmentId);
  if (!environment) {
    throw new ResourceNotFoundError("environment", environmentId);
  }

  return environment.productId;
};

export const getProductIdFromSurveyId = async (surveyId: string) => {
  const survey = await getSurvey(surveyId);
  if (!survey) {
    throw new ResourceNotFoundError("survey", surveyId);
  }

  return await getProductIdFromEnvironmentId(survey.environmentId);
};

export const getProductIdFromInsightId = async (insightId: string) => {
  const insight = await getInsight(insightId);
  if (!insight) {
    throw new ResourceNotFoundError("insight", insightId);
  }

  return await getProductIdFromEnvironmentId(insight.environmentId);
};

export const getProductIdFromSegmentId = async (segmentId: string) => {
  const segment = await getSegment(segmentId);
  if (!segment) {
    throw new ResourceNotFoundError("segment", segmentId);
  }

  return await getProductIdFromEnvironmentId(segment.environmentId);
};

export const getProductIdFromApiKeyId = async (apiKeyId: string) => {
  const apiKey = await getApiKey(apiKeyId);
  if (!apiKey) {
    throw new ResourceNotFoundError("apiKey", apiKeyId);
  }

  return await getProductIdFromEnvironmentId(apiKey.environmentId);
};

export const getProductIdFromActionClassId = async (actionClassId: string) => {
  const actionClass = await getActionClass(actionClassId);
  if (!actionClass) {
    throw new ResourceNotFoundError("actionClass", actionClassId);
  }

  return await getProductIdFromEnvironmentId(actionClass.environmentId);
};

export const getProductIdFromTagId = async (tagId: string) => {
  const tag = await getTag(tagId);
  if (!tag) {
    throw new ResourceNotFoundError("tag", tagId);
  }

  return await getProductIdFromEnvironmentId(tag.environmentId);
};

export const getProductIdFromLanguageId = async (languageId: string) => {
  const language = await getLanguage(languageId);
  if (!language) {
    throw new ResourceNotFoundError("language", languageId);
  }

  return language.productId;
};

export const getProductIdFromResponseId = async (responseId: string) => {
  const response = await getResponse(responseId);
  if (!response) {
    throw new ResourceNotFoundError("response", responseId);
  }

  return await getProductIdFromSurveyId(response.surveyId);
};

export const getProductIdFromResponseNoteId = async (responseNoteId: string) => {
  const responseNote = await getResponseNote(responseNoteId);
  if (!responseNote) {
    throw new ResourceNotFoundError("responseNote", responseNoteId);
  }

  return await getProductIdFromResponseId(responseNote.responseId);
};

export const getProductIdFromPersonId = async (personId: string) => {
  const person = await getPerson(personId);
  if (!person) {
    throw new ResourceNotFoundError("person", personId);
  }

  return await getProductIdFromEnvironmentId(person.environmentId);
};

export const getProductIdFromDocumentId = async (documentId: string) => {
  const document = await getDocument(documentId);
  if (!document) {
    throw new ResourceNotFoundError("document", documentId);
  }

  return await getProductIdFromEnvironmentId(document.environmentId);
};

export const getProductIdFromIntegrationId = async (integrationId: string) => {
  const integration = await getIntegration(integrationId);
  if (!integration) {
    throw new ResourceNotFoundError("integration", integrationId);
  }

  return await getProductIdFromEnvironmentId(integration.environmentId);
};

// environment id helpers
export const getEnvironmentIdFromSurveyId = async (surveyId: string) => {
  const survey = await getSurvey(surveyId);
  if (!survey) {
    throw new ResourceNotFoundError("survey", surveyId);
  }

  return survey.environmentId;
};

export const getEnvironmentIdFromResponseId = async (responseId: string) => {
  const response = await getResponse(responseId);
  if (!response) {
    throw new ResourceNotFoundError("response", responseId);
  }

  return await getEnvironmentIdFromSurveyId(response.surveyId);
};

export const getEnvironmentIdFromInsightId = async (insightId: string) => {
  const insight = await getInsight(insightId);
  if (!insight) {
    throw new ResourceNotFoundError("insight", insightId);
  }

  return insight.environmentId;
};

export const getEnvironmentIdFromSegmentId = async (segmentId: string) => {
  const segment = await getSegment(segmentId);
  if (!segment) {
    throw new ResourceNotFoundError("segment", segmentId);
  }

  return segment.environmentId;
};

export const getEnvironmentIdFromTagId = async (tagId: string) => {
  const tag = await getTag(tagId);
  if (!tag) {
    throw new ResourceNotFoundError("tag", tagId);
  }

  return tag.environmentId;
};
