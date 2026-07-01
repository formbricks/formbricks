import "server-only";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";
import {
  ProcessedHiddenField,
  ProcessedResponseElement,
  ProcessedVariable,
  renderFollowUpEmail,
} from "@formbricks/email";
import { TResponse } from "@formbricks/types/responses";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { DEFAULT_LOCALE, IMPRINT_ADDRESS, IMPRINT_URL, PRIVACY_URL, TERMS_URL } from "@/lib/constants";
import { getElementResponseMapping } from "@/lib/responses";
import { parseRecallInfo } from "@/lib/utils/recall";
import { getTranslate } from "@/lingodotdev/server";
import { resolveStorageUrl } from "@/modules/storage/utils";

/**
 * Sanitize a recall-templated body the same way the survey Follow-Ups email does. Recall tags are
 * expanded against the response first, then only a narrow HTML allowlist survives — so
 * respondent-controlled recall values cannot inject markup or non-http(s) schemes.
 */
const sanitizeBody = (body: string, response: TResponse): string =>
  sanitizeHtml(parseRecallInfo(body, response.data, response.variables), {
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

const buildResponseData = (
  survey: TSurvey,
  response: TResponse,
  attachResponseData: boolean
): ProcessedResponseElement[] =>
  attachResponseData
    ? getElementResponseMapping(survey, response).map((e) => {
        // Resolve relative storage URLs to absolute URLs for picture selection and file upload responses.
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

const buildVariables = (
  survey: TSurvey,
  response: TResponse,
  attachResponseData: boolean,
  includeVariables: boolean
): ProcessedVariable[] =>
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

const buildHiddenFields = (
  survey: TSurvey,
  response: TResponse,
  attachResponseData: boolean,
  includeHiddenFields: boolean
): ProcessedHiddenField[] =>
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

/**
 * Builds the branded HTML for a survey-response email (Follow-Ups template): recall-expanded +
 * sanitized body, plus the optional response-data / variables / hidden-fields blocks. Pure of any
 * transport concern — the caller performs the actual send. Shared by survey Follow-Ups and the
 * workflow `send_email` action so both render identically.
 */
export const buildSurveyResponseEmailHtml = async ({
  body,
  survey,
  response,
  attachResponseData,
  includeVariables = false,
  includeHiddenFields = false,
  logoUrl,
  locale,
}: {
  body: string;
  survey: TSurvey;
  response: TResponse;
  attachResponseData: boolean;
  includeVariables?: boolean;
  includeHiddenFields?: boolean;
  logoUrl?: string;
  locale?: TUserLocale;
}): Promise<string> => {
  // Worker context (no request scope) — pass explicit locale to skip headers()/cookies().
  // Falls back to DEFAULT_LOCALE when the respondent locale wasn't captured at submission.
  const t = await getTranslate(locale ?? DEFAULT_LOCALE);

  return renderFollowUpEmail({
    body: sanitizeBody(body, response),
    responseData: buildResponseData(survey, response, attachResponseData),
    variables: buildVariables(survey, response, attachResponseData, includeVariables),
    hiddenFields: buildHiddenFields(survey, response, attachResponseData, includeHiddenFields),
    logoUrl,
    t,
    privacyUrl: PRIVACY_URL || undefined,
    termsUrl: TERMS_URL || undefined,
    imprintUrl: IMPRINT_URL || undefined,
    imprintAddress: IMPRINT_ADDRESS || undefined,
  });
};

/** Outcome of resolving a `to` value (literal email or question/hidden-field id) against a response. */
export type ResolveRecipientResult = { ok: true; email: string } | { ok: false; error: string };

/**
 * Resolves an email recipient from a `to` value the same way survey Follow-Ups do:
 *  - if `to` is itself a valid email, use it directly (teammate/user address);
 *  - otherwise treat `to` as a question / hidden-field id and read `response.data[to]`:
 *      - a string is parsed as an email,
 *      - an array (contact-info element) uses index `[2]` as the email,
 *  - anything missing/invalid returns `{ ok: false }` with a clear reason.
 */
export const resolveResponseRecipient = (to: string, response: TResponse): ResolveRecipientResult => {
  const parsedEmailTo = z.email().safeParse(to);
  if (parsedEmailTo.success) {
    return { ok: true, email: parsedEmailTo.data };
  }

  const toValueFromResponse = response.data[to];
  if (!toValueFromResponse) {
    return { ok: false, error: "Recipient value not found in response data" };
  }

  if (typeof toValueFromResponse === "string") {
    const parsedResult = z.email().safeParse(toValueFromResponse);
    if (parsedResult.success) {
      return { ok: true, email: parsedResult.data };
    }
    return { ok: false, error: "Resolved email recipient is not a valid address" };
  }

  if (Array.isArray(toValueFromResponse)) {
    const emailAddress = toValueFromResponse[2];
    if (!emailAddress) {
      return { ok: false, error: "Email address not found in response data" };
    }
    const parsedResult = z.email().safeParse(emailAddress);
    if (parsedResult.success) {
      return { ok: true, email: parsedResult.data };
    }
    return { ok: false, error: "Resolved email recipient is not a valid address" };
  }

  return { ok: false, error: "Resolved email recipient is not a valid address" };
};
