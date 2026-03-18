import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import type { TResponse } from "@formbricks/types/responses";
import type { TSurvey } from "@formbricks/types/surveys/types";

export interface SurveyResponseRow {
  RESPONSE_ID: string;
  SURVEY_ID: string;
  SURVEY_NAME: string;
  RECORD_NUMBER: string | null;
  CREATED_AT: string; // ISO timestamp
  FINISHED: boolean;
  QUESTION_ID: string;
  QUESTION_TEXT: string;
  QUESTION_TYPE: string;
  ANSWER: string;
  LANGUAGE: string | null;
  SOURCE_URL: string | null;
}

/**
 * Resolve RECORD_NUMBER from hidden fields and contact attributes.
 * Checks (case-insensitive): recordnumber, customerid, contactid
 */
function resolveRecordNumber(
  responseData: TResponse["data"],
  contactAttributes: Record<string, string> | null
): string | null {
  const keys = ["recordnumber", "customerid", "contactid"];

  // Check hidden fields / response data first
  for (const key of keys) {
    for (const [dataKey, dataValue] of Object.entries(responseData)) {
      if (dataKey.toLowerCase() === key && dataValue != null) {
        const val = typeof dataValue === "string" ? dataValue : String(dataValue);
        if (val.trim()) return val.trim();
      }
    }
  }

  // Check contact attributes
  if (contactAttributes) {
    for (const key of keys) {
      for (const [attrKey, attrValue] of Object.entries(contactAttributes)) {
        if (attrKey.toLowerCase() === key && attrValue?.trim()) {
          return attrValue.trim();
        }
      }
    }
  }

  return null;
}

/**
 * Get the default-language headline text from an i18n string record
 */
function getHeadlineText(headline: Record<string, string> | undefined): string {
  if (!headline) return "";
  return headline["default"] || Object.values(headline)[0] || "";
}

/**
 * Build a map of element ID -> { headline, type } from survey blocks and questions
 */
function buildElementMap(survey: TSurvey): Map<string, { headline: string; type: string }> {
  const map = new Map<string, { headline: string; type: string }>();

  // From blocks (new format)
  if (survey.blocks?.length) {
    for (const block of survey.blocks) {
      for (const element of block.elements) {
        map.set(element.id, {
          headline: getHeadlineText(element.headline as Record<string, string>),
          type: element.type,
        });
      }
    }
  }

  // From questions (legacy format, may coexist)
  if (survey.questions?.length) {
    for (const question of survey.questions) {
      if (!map.has(question.id)) {
        map.set(question.id, {
          headline: getHeadlineText(question.headline as Record<string, string>),
          type: question.type,
        });
      }
    }
  }

  return map;
}

/**
 * Build Snowflake rows from a pipeline response event.
 * Returns one row per question/hidden-field/contact-attribute.
 */
export async function buildSnowflakeRows(survey: TSurvey, response: TResponse): Promise<SurveyResponseRow[]> {
  const rows: SurveyResponseRow[] = [];
  const elementMap = buildElementMap(survey);
  const hiddenFieldIds = new Set((survey.hiddenFields?.fieldIds ?? []).map((id) => id.toLowerCase()));

  // Load contact attributes if contact exists
  let contactAttributes: Record<string, string> | null = null;
  if (response.contact?.id) {
    try {
      const attrs = await prisma.contactAttribute.findMany({
        where: { contactId: response.contact.id },
        select: { attributeKey: { select: { key: true } }, value: true },
      });
      contactAttributes = {};
      for (const attr of attrs) {
        contactAttributes[attr.attributeKey.key] = attr.value;
      }
    } catch (error) {
      logger.error({ error }, "Failed to fetch contact attributes for Snowflake sync");
    }
  }

  const recordNumber = resolveRecordNumber(response.data, contactAttributes);
  const createdAt = response.createdAt.toISOString();
  const sourceUrl = response.meta?.url ?? null;
  const language = response.language ?? null;

  const baseRow = {
    RESPONSE_ID: response.id,
    SURVEY_ID: survey.id,
    SURVEY_NAME: survey.name,
    RECORD_NUMBER: recordNumber,
    CREATED_AT: createdAt,
    FINISHED: response.finished,
    LANGUAGE: language,
    SOURCE_URL: sourceUrl,
  };

  // Process each response data entry
  for (const [key, value] of Object.entries(response.data)) {
    if (value == null) continue;

    const answerStr = typeof value === "string" ? value : JSON.stringify(value);
    const element = elementMap.get(key);

    if (element) {
      // It's a survey question/element
      rows.push({
        ...baseRow,
        QUESTION_ID: key,
        QUESTION_TEXT: element.headline,
        QUESTION_TYPE: element.type,
        ANSWER: answerStr,
      });
    } else if (hiddenFieldIds.has(key.toLowerCase())) {
      // It's a hidden field
      rows.push({
        ...baseRow,
        QUESTION_ID: key,
        QUESTION_TEXT: key,
        QUESTION_TYPE: "hiddenField",
        ANSWER: answerStr,
      });
    } else {
      // Unknown key — include as generic data
      rows.push({
        ...baseRow,
        QUESTION_ID: key,
        QUESTION_TEXT: key,
        QUESTION_TYPE: "unknown",
        ANSWER: answerStr,
      });
    }
  }

  // Add contact attributes as rows
  if (contactAttributes) {
    for (const [attrKey, attrValue] of Object.entries(contactAttributes)) {
      if (attrValue == null) continue;
      rows.push({
        ...baseRow,
        QUESTION_ID: `contact_${attrKey}`,
        QUESTION_TEXT: attrKey,
        QUESTION_TYPE: "contactAttribute",
        ANSWER: String(attrValue),
      });
    }
  }

  return rows;
}
