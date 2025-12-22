import sanitizeHtml from "sanitize-html";
import { TSurveyFollowUp } from "@formbricks/database/types/survey-follow-up";
import {
  ProcessedHiddenField,
  ProcessedResponseElement,
  ProcessedVariable,
  renderFollowUpEmail,
} from "@formbricks/email";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getElementResponseMapping } from "@/lib/responses";
import { parseRecallInfo } from "@/lib/utils/recall";
import { getTranslate } from "@/lingodotdev/server";
import { sendEmail } from "@/modules/email";

export const sendFollowUpEmail = async ({
  followUp,
  to,
  replyTo,
  survey,
  response,
  attachResponseData = false,
  includeVariables = false,
  includeHiddenFields = false,
  logoUrl,
}: {
  followUp: TSurveyFollowUp;
  to: string;
  replyTo: string[];
  attachResponseData: boolean;
  includeVariables?: boolean;
  includeHiddenFields?: boolean;
  survey: TSurvey;
  response: TResponse;
  logoUrl?: string;
}): Promise<void> => {
  const {
    action: {
      properties: { subject, body },
    },
  } = followUp;

  const t = await getTranslate();

  // Process body: parse recall tags and sanitize HTML
  const processedBody = sanitizeHtml(parseRecallInfo(body, response.data, response.variables), {
    allowedTags: ["p", "span", "b", "strong", "i", "em", "a", "br"],
    allowedAttributes: {
      a: ["href", "rel", "target"],
      "*": ["dir", "class"],
    },
    allowedSchemes: ["http", "https"],
    allowedSchemesByTag: {
      a: ["http", "https"],
    },
  });

  // Process response data
  const responseData: ProcessedResponseElement[] = attachResponseData
    ? getElementResponseMapping(survey, response).map((e) => ({
        element: e.element,
        response: e.response,
        type: e.type,
      }))
    : [];

  // Process variables
  const variables: ProcessedVariable[] =
    attachResponseData && includeVariables
      ? survey.variables
          .filter((variable) => {
            const variableResponse = response.variables[variable.id];
            return (
              (typeof variableResponse === "string" || typeof variableResponse === "number") &&
              variableResponse !== undefined
            );
          })
          .map((variable) => ({
            id: variable.id,
            name: variable.name,
            type: variable.type,
            value: response.variables[variable.id],
          }))
      : [];

  // Process hidden fields
  const hiddenFields: ProcessedHiddenField[] =
    attachResponseData && includeHiddenFields
      ? (survey.hiddenFields.fieldIds
          ?.filter((hiddenFieldId) => {
            const hiddenFieldResponse = response.data[hiddenFieldId];
            return hiddenFieldResponse && typeof hiddenFieldResponse === "string";
          })
          .map((hiddenFieldId) => ({
            id: hiddenFieldId,
            value: response.data[hiddenFieldId] as string,
          })) ?? [])
      : [];

  const emailHtmlBody = await renderFollowUpEmail({
    body: processedBody,
    responseData,
    variables,
    hiddenFields,
    logoUrl,
    t,
  });

  await sendEmail({
    to,
    replyTo: replyTo.join(", "),
    subject,
    html: emailHtmlBody,
  });
};
