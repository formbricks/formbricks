import "server-only";
import { TConnectorFormbricksMapping, THubFieldType } from "@formbricks/types/connector";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TCreateFeedbackRecordInput, THubFieldType as THubClientFieldType } from "./hub-client";

// Response data value types
type TResponseValue = string | number | string[] | Record<string, string> | undefined;

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

/**
 * Get the headline of an element from a survey, with HTML tags stripped
 */
function getElementHeadline(survey: TSurvey, elementId: string): string {
  let raw = "Untitled";

  // Try to find in blocks first
  if (survey.blocks && survey.blocks.length > 0) {
    for (const block of survey.blocks) {
      if (block.elements) {
        for (const element of block.elements) {
          if (element.id === elementId) {
            const headline = element.headline;
            if (!headline) return "Untitled";
            if (typeof headline === "string") raw = headline;
            else if (typeof headline === "object" && headline.default) raw = headline.default;
            return stripHtmlTags(raw) || "Untitled";
          }
        }
      }
    }
  }

  // Fallback to legacy questions
  if (survey.questions && Array.isArray(survey.questions)) {
    for (const question of survey.questions as Array<{
      id: string;
      headline?: string | { default?: string };
    }>) {
      if (question.id === elementId) {
        const headline = question.headline;
        if (!headline) return "Untitled";
        if (typeof headline === "string") raw = headline;
        else if (typeof headline === "object" && headline.default) raw = headline.default;
        return stripHtmlTags(raw) || "Untitled";
      }
    }
  }

  return "Untitled";
}

/**
 * Extract the value from a response for a specific element
 */
function extractResponseValue(responseData: TResponse["data"], elementId: string): TResponseValue {
  if (!responseData || typeof responseData !== "object") return undefined;
  return (responseData as Record<string, TResponseValue>)[elementId];
}

/**
 * Convert a response value to the appropriate Hub value fields
 */
function convertValueToHubFields(
  value: TResponseValue,
  hubFieldType: THubFieldType
): Partial<Pick<TCreateFeedbackRecordInput, "value_text" | "value_number" | "value_boolean" | "value_date">> {
  if (value === undefined || value === null) {
    return {};
  }

  switch (hubFieldType) {
    case "text":
      // Text values - could be string or array of strings
      if (typeof value === "string") {
        return { value_text: value };
      }
      if (Array.isArray(value)) {
        return { value_text: value.join(", ") };
      }
      if (typeof value === "object") {
        // Handle address-like objects
        return { value_text: JSON.stringify(value) };
      }
      return { value_text: String(value) };

    case "number":
    case "rating":
    case "nps":
    case "csat":
    case "ces":
      // Numeric values
      if (typeof value === "number") {
        return { value_number: value };
      }
      if (typeof value === "string") {
        const parsed = parseFloat(value);
        if (!isNaN(parsed)) {
          return { value_number: parsed };
        }
      }
      return {};

    case "boolean":
      // Boolean values
      if (typeof value === "boolean") {
        return { value_boolean: value };
      }
      if (typeof value === "string") {
        return { value_boolean: value.toLowerCase() === "true" || value === "1" };
      }
      return {};

    case "date":
      // Date values
      if (typeof value === "string") {
        return { value_date: value };
      }
      if (value instanceof Date) {
        return { value_date: value.toISOString() };
      }
      return {};

    case "categorical":
      // Categorical values (like multiple choice)
      if (typeof value === "string") {
        return { value_text: value };
      }
      if (Array.isArray(value)) {
        return { value_text: value.join(", ") };
      }
      return { value_text: String(value) };

    default:
      // Default to text
      if (typeof value === "string") {
        return { value_text: value };
      }
      return { value_text: String(value) };
  }
}

/**
 * Transform a Formbricks survey response into Hub FeedbackRecord payloads
 *
 * @param response - The Formbricks response
 * @param survey - The survey the response belongs to
 * @param mappings - The connector mappings for this survey
 * @param tenantId - Optional tenant ID (usually environment or organization ID)
 * @returns Array of FeedbackRecord payloads to send to the Hub
 */
export function transformResponseToFeedbackRecords(
  response: TResponse,
  survey: TSurvey,
  mappings: TConnectorFormbricksMapping[],
  tenantId?: string
): TCreateFeedbackRecordInput[] {
  const feedbackRecords: TCreateFeedbackRecordInput[] = [];

  // Get response data
  const responseData = response.data;
  if (!responseData) {
    return feedbackRecords;
  }

  // Filter mappings to only those for this survey
  const surveyMappings = mappings.filter((m) => m.surveyId === survey.id);

  // For each mapped element, create a FeedbackRecord
  for (const mapping of surveyMappings) {
    const value = extractResponseValue(responseData, mapping.elementId);

    // Skip if no value for this element
    if (value === undefined || value === null || value === "") {
      continue;
    }

    // Get element headline (or use custom field label)
    const fieldLabel = mapping.customFieldLabel || getElementHeadline(survey, mapping.elementId);

    // Convert value to appropriate Hub fields
    const valueFields = convertValueToHubFields(value, mapping.hubFieldType as THubFieldType);

    // Build the FeedbackRecord payload, only including defined values
    const feedbackRecord: TCreateFeedbackRecordInput = {
      collected_at:
        response.createdAt instanceof Date ? response.createdAt.toISOString() : String(response.createdAt),
      source_type: "formbricks",
      field_id: mapping.elementId,
      field_type: mapping.hubFieldType as THubClientFieldType,
      source_id: survey.id,
      source_name: survey.name,
      field_label: fieldLabel,
      ...valueFields,
    };

    // Only add optional string fields if they have a truthy value
    if (response.language && response.language !== "default") {
      feedbackRecord.language = response.language;
    }

    if (tenantId) {
      feedbackRecord.tenant_id = tenantId;
    }

    if (response.contactId) {
      feedbackRecord.user_identifier = response.contactId;
    }

    feedbackRecords.push(feedbackRecord);
  }

  return feedbackRecords;
}

/**
 * Transform a CSV row to a FeedbackRecord using field mappings
 *
 * @param row - The CSV row as an object (column name -> value)
 * @param mappings - The field mappings for this connector
 * @returns FeedbackRecord payload to send to the Hub
 */
export function transformCSVRowToFeedbackRecord(
  row: Record<string, string>,
  mappings: Array<{
    sourceFieldId: string;
    targetFieldId: string;
    staticValue?: string | null;
  }>
): TCreateFeedbackRecordInput {
  const feedbackRecord: Record<string, unknown> = {};

  for (const mapping of mappings) {
    let value: unknown;

    if (mapping.staticValue) {
      // Use static value
      value = mapping.staticValue;

      // Handle special static values
      if (value === "$now") {
        value = new Date().toISOString();
      }
    } else {
      // Get value from CSV row
      value = row[mapping.sourceFieldId];
    }

    if (value !== undefined && value !== null && value !== "") {
      // Try to convert to appropriate type based on target field
      if (mapping.targetFieldId === "value_number") {
        const parsed = parseFloat(String(value));
        if (!isNaN(parsed)) {
          feedbackRecord[mapping.targetFieldId] = parsed;
          continue;
        }
      }
      if (mapping.targetFieldId === "value_boolean") {
        feedbackRecord[mapping.targetFieldId] =
          String(value).toLowerCase() === "true" || String(value) === "1";
        continue;
      }

      feedbackRecord[mapping.targetFieldId] = value;
    }
  }

  // Ensure required fields have defaults
  if (!feedbackRecord.source_type) {
    feedbackRecord.source_type = "csv";
  }
  if (!feedbackRecord.collected_at) {
    feedbackRecord.collected_at = new Date().toISOString();
  }
  if (!feedbackRecord.field_type) {
    feedbackRecord.field_type = "text";
  }

  return feedbackRecord as TCreateFeedbackRecordInput;
}
