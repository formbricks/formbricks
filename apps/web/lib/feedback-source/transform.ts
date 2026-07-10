import "server-only";
import { TFeedbackSourceFormbricksMapping, THubFieldType } from "@formbricks/types/feedback-source";
import { TResponse, TResponseData, TResponseDataValue } from "@formbricks/types/responses";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import type {
  TSurveyElement,
  TSurveyElementChoice,
  TSurveyMatrixElement,
  TSurveyMatrixElementChoice,
  TSurveyRankingElement,
} from "@formbricks/types/surveys/elements";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { getLanguageCode, getLocalizedValue } from "@/lib/i18n/utils";
import { getElementsFromBlocks } from "@/lib/survey/utils";
import type { FeedbackRecordCreateParams } from "@/modules/hub";

const getHeadlineFromElement = (element?: TSurveyElement): string => {
  if (!element?.headline) return "Untitled";
  const raw = getLocalizedValue(element.headline, "default");
  return getTextContent(raw) || "Untitled";
};

const getChoiceLabel = (choice: { label: TSurveyElementChoice["label"] }, language: string): string => {
  return getTextContent(getLocalizedValue(choice.label, language));
};

const findChoiceByLabel = <T extends { id: string; label: TSurveyElementChoice["label"] }>(
  choices: T[],
  label: string,
  language: string
): T | undefined => {
  return choices.find((choice) => getChoiceLabel(choice, language) === label);
};

interface NormalizedChoiceValue {
  value: TResponseDataValue;
  /**
   * Stable id of the matched choice (ENG-1673). Only set for single-value answers that
   * matched a choice — multi-value answers collapse into one joined record that cannot
   * carry multiple ids, and unmatched values ("other" free text, edited labels) have none.
   */
  valueId?: string;
}

/**
 * Selected choice values arrive as labels localized to the response language. For a matched
 * single choice we store the choice's default-language label as the canonical value_text, so
 * the same option is one category across languages (mirrors how field_label is canonicalized),
 * and additionally keep value_id (ENG-1673) as its stable id for label-edit resilience. Values
 * that match no choice (an "other" free-text answer, a label edited since submission) and
 * multi-select arrays (ENG-1702) pass through as submitted and carry no id.
 */
const normalizeChoiceValue = (
  choices: { id: string; label: TSurveyElementChoice["label"] }[] | undefined,
  value: TResponseDataValue,
  language: string
): NormalizedChoiceValue => {
  if (!choices?.length) return { value };

  if (typeof value === "string") {
    const choice = findChoiceByLabel(choices, value, language);
    return choice ? { value: getChoiceLabel(choice, "default"), valueId: choice.id } : { value };
  }

  return { value };
};

const toIsoTimestamp = (value: unknown): string | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  return null;
};

const getCollectedAt = (response: TResponse): string => {
  return toIsoTimestamp(response.createdAt) ?? toIsoTimestamp(response.updatedAt) ?? new Date().toISOString();
};

function extractResponseValue(responseData: TResponseData, elementId: string): TResponseDataValue {
  if (!responseData || typeof responseData !== "object") return undefined;
  return responseData[elementId];
}

const convertValueToHubFields = (
  value: TResponseDataValue,
  hubFieldType: THubFieldType
): Partial<
  Pick<FeedbackRecordCreateParams, "value_text" | "value_number" | "value_boolean" | "value_date">
> => {
  if (value === undefined || value === null) {
    return {};
  }

  switch (hubFieldType) {
    case "text":
      if (typeof value === "string") return { value_text: value };
      if (Array.isArray(value)) return { value_text: value.join(", ") };
      if (typeof value === "object") return { value_text: JSON.stringify(value) };
      return { value_text: String(value) };

    case "number":
    case "rating":
    case "nps":
    case "csat":
    case "ces":
      if (typeof value === "number") return { value_number: value };
      if (typeof value === "string") {
        const parsed = Number.parseFloat(value);
        if (!Number.isNaN(parsed)) return { value_number: parsed };
      }
      return {};

    case "boolean":
      if (typeof value === "boolean") return { value_boolean: value };
      if (typeof value === "string") {
        return { value_boolean: value.toLowerCase() === "true" || value === "1" };
      }
      return {};

    case "date":
      if (typeof value === "string") {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) return { value_date: date.toISOString() };
      }
      if (value instanceof Date) return { value_date: value.toISOString() };
      return {};

    case "categorical":
      if (typeof value === "string") return { value_text: value };
      if (Array.isArray(value)) return { value_text: value.join(", ") };
      if (typeof value === "object") return { value_text: JSON.stringify(value) };
      return { value_text: String(value) };

    default:
      if (typeof value === "string") return { value_text: value };
      if (Array.isArray(value)) return { value_text: value.join(", ") };
      if (typeof value === "object") return { value_text: JSON.stringify(value) };
      return { value_text: String(value) };
  }
};

type BaseRecordFields = Pick<
  FeedbackRecordCreateParams,
  "collected_at" | "source_type" | "submission_id" | "tenant_id" | "source_id" | "source_name"
> & {
  language?: string;
  user_id?: string;
};

const buildBaseFields = (
  response: TResponse,
  survey: Pick<TSurvey, "id" | "name">,
  tenantId: string
): BaseRecordFields => ({
  collected_at: getCollectedAt(response),
  source_type: "formbricks_survey",
  submission_id: response.id,
  tenant_id: tenantId,
  source_id: survey.id,
  source_name: survey.name,
  ...(response.language && response.language !== "default" ? { language: response.language } : {}),
  ...(response.contact?.userId ? { user_id: response.contact.userId } : {}),
});

const expandMatrixToRecords = (
  element: TSurveyMatrixElement,
  mapping: TFeedbackSourceFormbricksMapping,
  value: TResponseDataValue,
  baseFields: BaseRecordFields,
  lookupLanguage: string
): FeedbackRecordCreateParams[] => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];

  const groupLabel = mapping.customFieldLabel || getHeadlineFromElement(element);
  const records: FeedbackRecordCreateParams[] = [];

  for (const [rowLabel, columnLabel] of Object.entries(value)) {
    if (columnLabel === undefined || columnLabel === null || columnLabel === "") continue;

    const row = findChoiceByLabel<TSurveyMatrixElementChoice>(element.rows, rowLabel, lookupLanguage);
    if (!row) continue;

    // Column labels are localized like the row labels — store the label as submitted and
    // attach the column id as stable cross-language identity (ENG-1673).
    const matchedColumn = normalizeChoiceValue(
      element.columns,
      columnLabel as TResponseDataValue,
      lookupLanguage
    );
    const valueFields = convertValueToHubFields(matchedColumn.value, mapping.hubFieldType);

    records.push({
      ...baseFields,
      field_id: `${element.id}__${row.id}`,
      field_type: mapping.hubFieldType,
      field_label: getChoiceLabel(row, "default"),
      field_group_id: element.id,
      field_group_label: groupLabel,
      metadata: { question_type: "matrix" },
      ...valueFields,
      ...(matchedColumn.valueId ? { value_id: matchedColumn.valueId } : {}),
    });
  }

  return records;
};

const expandRankingToRecords = (
  element: TSurveyRankingElement,
  mapping: TFeedbackSourceFormbricksMapping,
  value: TResponseDataValue,
  baseFields: BaseRecordFields,
  lookupLanguage: string
): FeedbackRecordCreateParams[] => {
  if (!Array.isArray(value) || value.length === 0) return [];

  const groupLabel = mapping.customFieldLabel || getHeadlineFromElement(element);
  const records: FeedbackRecordCreateParams[] = [];

  value.forEach((itemLabel, index) => {
    if (typeof itemLabel !== "string" || itemLabel === "") return;

    const choice = findChoiceByLabel<TSurveyElementChoice>(element.choices, itemLabel, lookupLanguage);
    if (!choice) return;

    records.push({
      ...baseFields,
      field_id: `${element.id}__${choice.id}`,
      field_type: "number",
      field_label: getChoiceLabel(choice, "default"),
      field_group_id: element.id,
      field_group_label: groupLabel,
      metadata: { question_type: "ranking", total_items: value.length },
      value_number: index + 1,
    });
  });

  return records;
};

/**
 * Transform a Formbricks survey response into FeedbackRecord payloads.
 * Called from the pipeline handler when a response is created/finished.
 *
 * Matrix and ranking questions expand into one record per row/item, sharing a
 * field_group_id so Hub analytics can aggregate across them.
 */
export function transformResponseToFeedbackRecords(
  response: TResponse,
  survey: Pick<TSurvey, "id" | "name" | "blocks" | "languages">,
  mappings: TFeedbackSourceFormbricksMapping[],
  tenantId: string
): FeedbackRecordCreateParams[] {
  const responseData = response.data;
  if (!responseData) return [];

  const surveyMappings = mappings.filter((m) => m.surveyId === survey.id);
  const elements = getElementsFromBlocks(survey.blocks);
  const elementMap = new Map(elements.map((el) => [el.id, el]));
  const baseFields = buildBaseFields(response, survey, tenantId);
  // Responses in the survey's default language may carry its concrete code (e.g. "en-US")
  // while choice labels store that language under the "default" key — resolve the code to
  // the label key so choice matching for value_id (ENG-1673) works.
  const lookupLanguage = getLanguageCode(survey.languages ?? [], response.language ?? null);
  const feedbackRecords: FeedbackRecordCreateParams[] = [];

  for (const mapping of surveyMappings) {
    const value = extractResponseValue(responseData, mapping.elementId);
    if (value === undefined || value === null || value === "") continue;

    const element = elementMap.get(mapping.elementId);

    if (element?.type === TSurveyElementTypeEnum.Matrix) {
      feedbackRecords.push(...expandMatrixToRecords(element, mapping, value, baseFields, lookupLanguage));
      continue;
    }

    if (element?.type === TSurveyElementTypeEnum.Ranking) {
      feedbackRecords.push(...expandRankingToRecords(element, mapping, value, baseFields, lookupLanguage));
      continue;
    }

    const fieldLabel = mapping.customFieldLabel || getHeadlineFromElement(element);

    const isChoiceElement =
      element &&
      (element.type === TSurveyElementTypeEnum.MultipleChoiceSingle ||
        element.type === TSurveyElementTypeEnum.MultipleChoiceMulti);
    const normalized = isChoiceElement
      ? normalizeChoiceValue(element.choices, value, lookupLanguage)
      : { value };

    const valueFields = convertValueToHubFields(normalized.value, mapping.hubFieldType);

    feedbackRecords.push({
      ...baseFields,
      field_id: mapping.elementId,
      field_type: mapping.hubFieldType,
      field_label: fieldLabel,
      ...valueFields,
      ...(normalized.valueId ? { value_id: normalized.valueId } : {}),
    });
  }

  return feedbackRecords;
}
