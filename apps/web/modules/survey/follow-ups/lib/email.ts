import sanitizeHtml from "sanitize-html";
import {
  ProcessedHiddenField,
  ProcessedResponseElement,
  ProcessedVariable,
  renderFollowUpEmail,
} from "@formbricks/email";
import { TResponse } from "@formbricks/types/responses";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurveyFollowUp } from "@formbricks/types/surveys/follow-up";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { DEFAULT_LOCALE, IMPRINT_ADDRESS, IMPRINT_URL, PRIVACY_URL, TERMS_URL } from "@/lib/constants";
import { getElementResponseMapping } from "@/lib/responses";
import { parseRecallInfo } from "@/lib/utils/recall";
import { getTranslate } from "@/lingodotdev/server";
import { sendEmail } from "@/modules/email";
import { resolveStorageUrl } from "@/modules/storage/utils";

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
  locale,
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
  locale?: TUserLocale;
}): Promise<void> => {
  const {
    action: {
      properties: { subject, body },
    },
  } = followUp;

  // Worker context (no request scope) — pass explicit locale to skip headers()/cookies().
  // Falls back to DEFAULT_LOCALE when the respondent locale wasn't captured at submission.
  const t = await getTranslate(locale ?? DEFAULT_LOCALE);

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
  // Resolve relative storage URLs to absolute URLs for email rendering
  const responseData: ProcessedResponseElement[] = attachResponseData
    ? getElementResponseMapping(survey, response).map((e) => {
        // Resolve URLs for picture selection and file upload responses
        if (
          (e.type === TSurveyElementTypeEnum.PictureSelection ||
            e.type === TSurveyElementTypeEnum.FileUpload) &&
          Array.isArray(e.response)
        ) {
          return {
            element: e.element,
            response: e.response.map((url) => resolveStorageUrl(url)),
            type: e.type,
          };
        }
        return {
          element: e.element,
          response: e.response,
          type: e.type,
        };
      })
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
    privacyUrl: PRIVACY_URL || undefined,
    termsUrl: TERMS_URL || undefined,
    imprintUrl: IMPRINT_URL || undefined,
    imprintAddress: IMPRINT_ADDRESS || undefined,
  });

  await sendEmail({
    to,
    replyTo: replyTo.join(", "),
    subject,
    html: emailHtmlBody,
  });
};
