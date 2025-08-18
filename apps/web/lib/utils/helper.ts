import {
  getActionClass,
  getApiKey,
  getContact,
  getDocument,
  getEnvironment,
  getInsight,
  getIntegration,
  getInvite,
  getLanguage,
  getProject,
  getResponse,
  getSegment,
  getSurvey,
  getTag,
  getTeam,
  getWebhook,
} from "@/lib/utils/services";
import { ResourceNotFoundError } from "@formbricks/types/errors";

export const getFormattedErrorMessage = (result): string => {
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

export const getOrganizationIdFromProjectId = async (projectId: string) => {
  const project = await getProject(projectId);
  if (!project) {
    throw new ResourceNotFoundError("project", projectId);
  }

  return project.organizationId;
};

export const getOrganizationIdFromEnvironmentId = async (environmentId: string) => {
  const environment = await getEnvironment(environmentId);
  if (!environment) {
    throw new ResourceNotFoundError("environment", environmentId);
  }

  return await getOrganizationIdFromProjectId(environment.projectId);
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

export const getOrganizationIdFromContactId = async (contactId: string) => {
  const contact = await getContact(contactId);
  if (!contact) {
    throw new ResourceNotFoundError("contact", contactId);
  }

  return await getOrganizationIdFromEnvironmentId(contact.environmentId);
};

export const getProjectIdFromContactId = async (contactId: string) => {
  const contact = await getContact(contactId);
  if (!contact) {
    throw new ResourceNotFoundError("contact", contactId);
  }

  return await getProjectIdFromEnvironmentId(contact.environmentId);
};

export const getOrganizationIdFromTagId = async (tagId: string) => {
  const tag = await getTag(tagId);
  if (!tag) {
    throw new ResourceNotFoundError("tag", tagId);
  }

  return await getOrganizationIdFromEnvironmentId(tag.environmentId);
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

  return apiKeyFromServer.organizationId;
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

  return await getOrganizationIdFromProjectId(language.projectId);
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

// project id helpers
export const getProjectIdFromEnvironmentId = async (environmentId: string) => {
  const environment = await getEnvironment(environmentId);
  if (!environment) {
    throw new ResourceNotFoundError("environment", environmentId);
  }

  return environment.projectId;
};

export const getProjectIdFromSurveyId = async (surveyId: string) => {
  const survey = await getSurvey(surveyId);
  if (!survey) {
    throw new ResourceNotFoundError("survey", surveyId);
  }

  return await getProjectIdFromEnvironmentId(survey.environmentId);
};

export const getProjectIdFromInsightId = async (insightId: string) => {
  const insight = await getInsight(insightId);
  if (!insight) {
    throw new ResourceNotFoundError("insight", insightId);
  }

  return await getProjectIdFromEnvironmentId(insight.environmentId);
};

export const getProjectIdFromSegmentId = async (segmentId: string) => {
  const segment = await getSegment(segmentId);
  if (!segment) {
    throw new ResourceNotFoundError("segment", segmentId);
  }

  return await getProjectIdFromEnvironmentId(segment.environmentId);
};

export const getProjectIdFromActionClassId = async (actionClassId: string) => {
  const actionClass = await getActionClass(actionClassId);
  if (!actionClass) {
    throw new ResourceNotFoundError("actionClass", actionClassId);
  }

  return await getProjectIdFromEnvironmentId(actionClass.environmentId);
};

export const getProjectIdFromTagId = async (tagId: string) => {
  const tag = await getTag(tagId);
  if (!tag) {
    throw new ResourceNotFoundError("tag", tagId);
  }

  return await getProjectIdFromEnvironmentId(tag.environmentId);
};

export const getProjectIdFromLanguageId = async (languageId: string) => {
  const language = await getLanguage(languageId);
  if (!language) {
    throw new ResourceNotFoundError("language", languageId);
  }

  return language.projectId;
};

export const getProjectIdFromResponseId = async (responseId: string) => {
  const response = await getResponse(responseId);
  if (!response) {
    throw new ResourceNotFoundError("response", responseId);
  }

  return await getProjectIdFromSurveyId(response.surveyId);
};

export const getProductIdFromContactId = async (contactId: string) => {
  const contact = await getContact(contactId);
  if (!contact) {
    throw new ResourceNotFoundError("contact", contactId);
  }

  return await getProjectIdFromEnvironmentId(contact.environmentId);
};

export const getProjectIdFromDocumentId = async (documentId: string) => {
  const document = await getDocument(documentId);
  if (!document) {
    throw new ResourceNotFoundError("document", documentId);
  }

  return await getProjectIdFromEnvironmentId(document.environmentId);
};

export const getProjectIdFromIntegrationId = async (integrationId: string) => {
  const integration = await getIntegration(integrationId);
  if (!integration) {
    throw new ResourceNotFoundError("integration", integrationId);
  }

  return await getProjectIdFromEnvironmentId(integration.environmentId);
};

export const getProjectIdFromWebhookId = async (webhookId: string) => {
  const webhook = await getWebhook(webhookId);
  if (!webhook) {
    throw new ResourceNotFoundError("webhook", webhookId);
  }

  return await getProjectIdFromEnvironmentId(webhook.environmentId);
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

export const isStringMatch = (query: string, value: string): boolean => {
  // lowercase both query and value
  // replace all spaces with empty string
  // replace all underscores with empty string
  // replace all dashes with empty string
  const queryModified = query.toLowerCase().replace(/ /g, "").replace(/_/g, "").replace(/-/g, "");
  const valueModified = value.toLowerCase().replace(/ /g, "").replace(/_/g, "").replace(/-/g, "");

  return valueModified.includes(queryModified);
};
