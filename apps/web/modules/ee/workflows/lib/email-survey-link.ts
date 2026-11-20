import {
  type TWorkflowSendEmailActionConfig,
  type TWorkflowSurveyLinkEmbeddedData,
  WORKFLOW_SURVEY_LINK_TOKEN,
} from "@formbricks/workflows";
import type { TSurveyLinkField } from "@/modules/ee/workflows/lib/survey-link-fields";
import type { TWorkflowVariableOption } from "@/modules/ee/workflows/lib/variable-picker";

/**
 * The Send email step's survey link (ENG-7180): which link survey the email carries, the Embedded
 * Data it puts on the link, and where the link goes in the body (`#survey-link#`, shown as a chip
 * with the survey's name). It is inserted from the message toolbar like a Variable.
 */

export const hasSurveyLinkToken = (body: string): boolean => body.includes(WORKFLOW_SURVEY_LINK_TOKEN);

// A paragraph holding only the link, with or without the editor's attributes (`class="…"`).
const SURVEY_LINK_PARAGRAPH = new RegExp(`<p(?: [^>]*)?>${WORKFLOW_SURVEY_LINK_TOKEN}</p>`, "g");

/**
 * Removing the link takes its token out of the body too, which Enable would otherwise refuse. A
 * line that held only the link goes with it.
 */
export const removeSurveyLinkToken = (body: string): string =>
  body.replaceAll(SURVEY_LINK_PARAGRAPH, "").replaceAll(WORKFLOW_SURVEY_LINK_TOKEN, "");

/** The chip's Remove: the link and its place in the body go together, so they can't disagree. */
export const withoutSurveyLink = (
  config: TWorkflowSendEmailActionConfig
): Pick<TWorkflowSendEmailActionConfig, "surveyLink" | "body"> => ({
  surveyLink: undefined,
  body: removeSurveyLinkToken(config.body),
});

/** A survey link that is set but not in the body, so the email would go out without it. */
export const hasUnplacedSurveyLink = (config: Pick<TWorkflowSendEmailActionConfig, "surveyLink" | "body">) =>
  config.surveyLink !== undefined && !hasSurveyLinkToken(config.body);

/**
 * A body edit, with the survey link following its chip: deleting the chip as text removes the link,
 * as the chip's Remove does (the editor's Undo brings both back). A link already set without a chip
 * (from the API) is left alone, so the problem shows instead of the link vanishing unseen.
 */
export const followSurveyLinkChip = (
  config: Pick<TWorkflowSendEmailActionConfig, "surveyLink" | "body">,
  nextBody: string
): Pick<TWorkflowSendEmailActionConfig, "body" | "surveyLink"> => {
  const deletesChip = hasSurveyLinkToken(config.body) && !hasSurveyLinkToken(nextBody);
  return deletesChip && config.surveyLink ? { body: nextBody, surveyLink: undefined } : { body: nextBody };
};

/**
 * Sets the value one Embedded Data field gets from the run. A blank value takes the field off the
 * link (the key would otherwise go out empty), so the list only ever holds fields that pass data.
 */
export const setEmbeddedDataValue = (
  embeddedData: readonly TWorkflowSurveyLinkEmbeddedData[],
  key: string,
  value: string
): TWorkflowSurveyLinkEmbeddedData[] => {
  if (value.trim() === "") return embeddedData.filter((row) => row.key !== key);
  if (!embeddedData.some((row) => row.key === key)) return [...embeddedData, { key, value }];
  return embeddedData.map((row) => (row.key === key ? { ...row, value } : row));
};

/** One line of "Pass run data to the survey": an Embedded Data field and the Variable it gets. */
export interface TSurveyLinkMappingRow {
  key: string;
  /** The field's name, or its key for a field the survey doesn't have. */
  name: string;
  value: string;
  /**
   * False for a key the survey doesn't take from its link (set through the API, or before the field
   * was removed): the send leaves it out, so the popover says so and offers to remove it.
   */
  isTaken: boolean;
}

/**
 * Every field the survey's link can set, in the survey's order, then the keys already set that it
 * doesn't take. Without the survey's fields (still loading, or unreadable) only the set keys show.
 */
export const getSurveyLinkMappingRows = (
  fields: readonly TSurveyLinkField[] | null,
  embeddedData: readonly TWorkflowSurveyLinkEmbeddedData[]
): TSurveyLinkMappingRow[] => {
  const valueOf = (key: string) => embeddedData.find((row) => row.key === key)?.value ?? "";
  const fieldRows = (fields ?? []).map((field) => ({
    key: field.key,
    name: field.name,
    value: valueOf(field.key),
    isTaken: true,
  }));
  const otherRows = embeddedData
    .filter((row) => !fields?.some((field) => field.key === row.key))
    .map((row) => ({ key: row.key, name: row.key, value: row.value, isTaken: fields === null }));
  return [...fieldRows, ...otherRows];
};

/** A Variable as the @ picker writes it into a field (ADR 0045). */
export const toVariableToken = (path: string): string => `#recall:${path}/fallback:#`;

const normalizeName = (name: string): string => name.toLowerCase().replaceAll(/[^a-z0-9]/g, "");

/** A Variable's own name parts: its path without the `payload.`, `response.` or `steps.<id>.` prefix. */
const getVariableNameSegments = (path: string): string[] => {
  const segments = path.split(".");
  return segments.slice(segments[0] === "steps" ? 2 : 1);
};

/**
 * How closely a Variable's name matches a field, ignoring case and separators: its label, or the
 * end of its path, read as one name (`customer_id` matches `payload.customer.id`). More matching
 * path segments score higher; 0 is no match.
 */
const getNameMatchScore = (fieldNames: readonly string[], option: TWorkflowVariableOption): number => {
  const segments = getVariableNameSegments(option.path);
  if (fieldNames.includes(normalizeName(option.label))) return segments.length + 1;
  for (let start = 0; start < segments.length; start++) {
    if (fieldNames.includes(normalizeName(segments.slice(start).join("")))) return segments.length - start;
  }
  return 0;
};

/**
 * The Variable to suggest for an Embedded Data field: one whose name matches the field's key or
 * name. Offered, never filled in on its own: the author decides what the survey receives.
 */
export const suggestVariableForField = (
  field: Pick<TSurveyLinkField, "key" | "name">,
  options: readonly TWorkflowVariableOption[]
): TWorkflowVariableOption | null => {
  const fieldNames = [normalizeName(field.key), normalizeName(field.name)].filter((name) => name !== "");
  let best: { option: TWorkflowVariableOption; score: number } | null = null;
  for (const option of options) {
    if (!option.isPickable) continue;
    const score = getNameMatchScore(fieldNames, option);
    if (score > (best?.score ?? 0)) best = { option, score };
  }
  return best?.option ?? null;
};
