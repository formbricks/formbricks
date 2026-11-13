import {
  type TWorkflowSurveyLinkEmbeddedData,
  WORKFLOW_SURVEY_LINK_TOKEN,
} from "../types/actions/send-email";
import type { TWorkflowRunContext } from "./context";
import { buildWorkflowQueryString, escapeWorkflowHtml, renderWorkflowText } from "./insert";

/**
 * The link a `send_email` step's survey link opens (ENG-7117 D2): `<public domain>/s/<surveyId>?key=value`.
 *
 * Only keys the survey accepts go on the link, written the way the survey declares them (the link
 * survey matches case-insensitively, but the declared spelling is never refused); the rest would be
 * dropped by the survey anyway, and an undeclared key could otherwise reach a parameter the link
 * survey reads for itself. Values insert Variables and are URL-encoded once; a value that comes out
 * empty is left off so it can't blank a field.
 */
export const buildWorkflowSurveyLink = ({
  publicDomain,
  surveyId,
  embeddedData,
  acceptedKeys,
  context,
}: {
  publicDomain: string;
  surveyId: string;
  embeddedData: readonly TWorkflowSurveyLinkEmbeddedData[];
  /** The survey's passed-in Embedded Data keys, as it declares them. */
  acceptedKeys: readonly string[];
  context: TWorkflowRunContext;
}): string => {
  const declaredByFolded = new Map(acceptedKeys.map((key) => [key.toLowerCase(), key]));
  const parameters = embeddedData.flatMap(({ key, value }) => {
    const declared = declaredByFolded.get(key.toLowerCase());
    if (declared === undefined) return [];
    return renderWorkflowText(value, context) === "" ? [] : [{ name: declared, value }];
  });
  const query = buildWorkflowQueryString(parameters, context);
  const base = `${publicDomain.replace(/\/+$/, "")}/s/${encodeURIComponent(surveyId)}`;
  return query === "" ? base : `${base}?${query}`;
};

/** Replaces each survey link token in an email body with a link to `url`, escaped for HTML. */
export const insertWorkflowSurveyLink = (body: string, url: string): string => {
  const escaped = escapeWorkflowHtml(url);
  return body.replaceAll(WORKFLOW_SURVEY_LINK_TOKEN, `<a href="${escaped}">${escaped}</a>`);
};
