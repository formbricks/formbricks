import { ResourceNotFoundError } from "@formbricks/types/errors";
import {
  getActionClass,
  getApiKey,
  getContact,
  getContactAttributeKey,
  getFeedbackSource,
  getIntegration,
  getInvite,
  getLanguage,
  getQuota,
  getResponse,
  getSegment,
  getSurvey,
  getTag,
  getTeam,
  getWebhook,
  getWorkspace,
} from "@/lib/utils/services";

export const getFormattedErrorMessage = (result: {
  serverError?: string;
  validationErrors?: unknown;
}): string => {
  let message = "";

  if (result.serverError) {
    message = result.serverError;
  } else {
    const errors = result.validationErrors as
      | Record<string, { _errors?: string[] } | string[] | undefined>
      | undefined;
    message = Object.keys(errors || {})
      .map((key) => {
        const value = errors?.[key];
        if (key === "_errors" && Array.isArray(value)) return value.join(", ");
        const fieldErrors =
          value && typeof value === "object" && "_errors" in value ? value._errors : undefined;
        const fieldError = fieldErrors?.join(", ");
        if (key && fieldError?.toLowerCase().startsWith(key.toLowerCase())) {
          return fieldError;
        }
        const keyPrefix = key ? `${key}: ` : "";
        return `${keyPrefix}${fieldError}`;
      })
      .join("\n");
  }

  return message;
};

/**
 * GET organization ID from RESOURCE ID
 */

export const getOrganizationIdFromWorkspaceId = async (workspaceId: string) => {
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) {
    throw new ResourceNotFoundError("workspace", workspaceId);
  }

  return workspace.organizationId;
};

export const getOrganizationIdFromSurveyId = async (surveyId: string) => {
  const survey = await getSurvey(surveyId);
  if (!survey) {
    throw new ResourceNotFoundError("survey", surveyId);
  }

  return await getOrganizationIdFromWorkspaceId(survey.workspaceId);
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

  return await getOrganizationIdFromWorkspaceId(contact.workspaceId);
};

export const getOrganizationIdFromContactAttributeKeyId = async (contactAttributeKeyId: string) => {
  const contactAttributeKey = await getContactAttributeKey(contactAttributeKeyId);
  if (!contactAttributeKey) {
    throw new ResourceNotFoundError("ContactAttributeKey", contactAttributeKeyId);
  }

  return await getOrganizationIdFromWorkspaceId(contactAttributeKey.workspaceId);
};

export const getOrganizationIdFromTagId = async (tagId: string) => {
  const tag = await getTag(tagId);
  if (!tag) {
    throw new ResourceNotFoundError("tag", tagId);
  }

  return await getOrganizationIdFromWorkspaceId(tag.workspaceId);
};

export const getOrganizationIdFromSegmentId = async (segmentId: string) => {
  const segment = await getSegment(segmentId);
  if (!segment) {
    throw new ResourceNotFoundError("segment", segmentId);
  }

  return await getOrganizationIdFromWorkspaceId(segment.workspaceId);
};

export const getOrganizationIdFromActionClassId = async (actionClassId: string) => {
  const actionClass = await getActionClass(actionClassId);
  if (!actionClass) {
    throw new ResourceNotFoundError("actionClass", actionClassId);
  }

  return await getOrganizationIdFromWorkspaceId(actionClass.workspaceId);
};

export const getOrganizationIdFromIntegrationId = async (integrationId: string) => {
  const integration = await getIntegration(integrationId);
  if (!integration) {
    throw new ResourceNotFoundError("integration", integrationId);
  }

  return await getOrganizationIdFromWorkspaceId(integration.workspaceId);
};

export const getOrganizationIdFromWebhookId = async (webhookId: string) => {
  const webhook = await getWebhook(webhookId);
  if (!webhook) {
    throw new ResourceNotFoundError("webhook", webhookId);
  }

  return await getOrganizationIdFromWorkspaceId(webhook.workspaceId);
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

  return await getOrganizationIdFromWorkspaceId(language.workspaceId);
};

export const getOrganizationIdFromTeamId = async (teamId: string) => {
  const team = await getTeam(teamId);
  if (!team) {
    throw new ResourceNotFoundError("team", teamId);
  }

  return team.organizationId;
};

export const getOrganizationIdFromQuotaId = async (quotaId: string) => {
  const quota = await getQuota(quotaId);

  return await getOrganizationIdFromSurveyId(quota.surveyId);
};

// workspace id helpers
export const getWorkspaceIdFromSurveyId = async (surveyId: string) => {
  const survey = await getSurvey(surveyId);
  if (!survey) {
    throw new ResourceNotFoundError("survey", surveyId);
  }

  return survey.workspaceId;
};

export const getWorkspaceIdFromSegmentId = async (segmentId: string) => {
  const segment = await getSegment(segmentId);
  if (!segment) {
    throw new ResourceNotFoundError("segment", segmentId);
  }

  return segment.workspaceId;
};

export const getWorkspaceIdFromActionClassId = async (actionClassId: string) => {
  const actionClass = await getActionClass(actionClassId);
  if (!actionClass) {
    throw new ResourceNotFoundError("actionClass", actionClassId);
  }

  return actionClass.workspaceId;
};

export const getWorkspaceIdFromTagId = async (tagId: string) => {
  const tag = await getTag(tagId);
  if (!tag) {
    throw new ResourceNotFoundError("tag", tagId);
  }

  return tag.workspaceId;
};

export const getWorkspaceIdFromLanguageId = async (languageId: string) => {
  const language = await getLanguage(languageId);
  if (!language) {
    throw new ResourceNotFoundError("language", languageId);
  }

  return language.workspaceId;
};

export const getWorkspaceIdFromResponseId = async (responseId: string) => {
  const response = await getResponse(responseId);
  if (!response) {
    throw new ResourceNotFoundError("response", responseId);
  }

  return await getWorkspaceIdFromSurveyId(response.surveyId);
};

export const getWorkspaceIdFromContactId = async (contactId: string) => {
  const contact = await getContact(contactId);
  if (!contact) {
    throw new ResourceNotFoundError("contact", contactId);
  }

  return contact.workspaceId;
};

export const getWorkspaceIdFromContactAttributeKeyId = async (contactAttributeKeyId: string) => {
  const contactAttributeKey = await getContactAttributeKey(contactAttributeKeyId);
  if (!contactAttributeKey) {
    throw new ResourceNotFoundError("ContactAttributeKey", contactAttributeKeyId);
  }

  return contactAttributeKey.workspaceId;
};

export const getWorkspaceIdFromIntegrationId = async (integrationId: string) => {
  const integration = await getIntegration(integrationId);
  if (!integration) {
    throw new ResourceNotFoundError("integration", integrationId);
  }

  return integration.workspaceId;
};

export const getWorkspaceIdFromWebhookId = async (webhookId: string) => {
  const webhook = await getWebhook(webhookId);
  if (!webhook) {
    throw new ResourceNotFoundError("webhook", webhookId);
  }

  return webhook.workspaceId;
};

export const getWorkspaceIdFromQuotaId = async (quotaId: string) => {
  const quota = await getQuota(quotaId);

  return await getWorkspaceIdFromSurveyId(quota.surveyId);
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

// FeedbackSource helpers
export const getOrganizationIdFromFeedbackSourceId = async (feedbackSourceId: string) => {
  const feedbackSource = await getFeedbackSource(feedbackSourceId);
  if (!feedbackSource) {
    throw new ResourceNotFoundError("feedbackSource", feedbackSourceId);
  }

  return await getOrganizationIdFromWorkspaceId(feedbackSource.workspaceId);
};
