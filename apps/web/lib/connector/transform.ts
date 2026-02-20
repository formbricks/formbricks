import "server-only";
import { TConnectorFormbricksMapping, THubFieldType } from "@formbricks/types/connector";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { getElementsFromBlocks } from "@/lib/survey/utils";
import { TCreateFeedbackRecordInput } from "./hub-client";

type TResponseValue = string | number | string[] | Record<string, string> | undefined;

const getElementHeadline = (survey: TSurvey, elementId: string): string => {
  const elements = getElementsFromBlocks(survey.blocks);
  const element = elements.find((el) => el.id === elementId);
  if (!element?.headline) return "Untitled";

  const raw = getLocalizedValue(element.headline, "default");
  return getTextContent(raw) || "Untitled";
};

function extractResponseValue(responseData: TResponse["data"], elementId: string): TResponseValue {
  if (!responseData || typeof responseData !== "object") return undefined;
  return (responseData as Record<string, TResponseValue>)[elementId];
}

const convertValueToHubFields = (
  value: TResponseValue,
  hubFieldType: THubFieldType
): Partial<
  Pick<TCreateFeedbackRecordInput, "value_text" | "value_number" | "value_boolean" | "value_date">
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
      if (typeof value === "string") return { value_date: value };
      if (value instanceof Date) return { value_date: value.toISOString() };
      return {};

    case "categorical":
      if (typeof value === "string") return { value_text: value };
      if (Array.isArray(value)) return { value_text: value.join(", ") };
      return { value_text: String(value) };

    default:
      return { value_text: typeof value === "string" ? value : String(value) };
  }
};

/**
 * Transform a Formbricks survey response into Hub FeedbackRecord payloads.
 * Called from the pipeline handler when a response is created/finished.
 */
export function transformResponseToFeedbackRecords(
  response: TResponse,
  survey: TSurvey,
  mappings: TConnectorFormbricksMapping[],
  tenantId?: string
): TCreateFeedbackRecordInput[] {
  const responseData = response.data;
  if (!responseData) return [];

  const surveyMappings = mappings.filter((m) => m.surveyId === survey.id);
  const feedbackRecords: TCreateFeedbackRecordInput[] = [];

  for (const mapping of surveyMappings) {
    const value = extractResponseValue(responseData, mapping.elementId);
    if (value === undefined || value === null || value === "") continue;

    const fieldLabel = mapping.customFieldLabel || getElementHeadline(survey, mapping.elementId);
    const valueFields = convertValueToHubFields(value, mapping.hubFieldType);

    const feedbackRecord: TCreateFeedbackRecordInput = {
      collected_at:
        response.createdAt instanceof Date ? response.createdAt.toISOString() : String(response.createdAt),
      source_type: "formbricks",
      field_id: mapping.elementId,
      field_type: mapping.hubFieldType,
      source_id: survey.id,
      source_name: survey.name,
      field_label: fieldLabel,
      ...valueFields,
    };

    if (response.language && response.language !== "default") {
      feedbackRecord.language = response.language;
    }

    if (tenantId) {
      feedbackRecord.tenant_id = tenantId;
    }

    if (response.contact?.userId) {
      feedbackRecord.user_identifier = response.contact.userId;
    }

    feedbackRecords.push(feedbackRecord);
  }

  return feedbackRecords;
}
