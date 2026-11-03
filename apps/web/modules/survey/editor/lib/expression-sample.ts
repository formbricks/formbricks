import type { TEmbeddedDataType } from "@formbricks/types/embedded-data";
import { RESERVED_FIELD_CATALOG, getSurveyEmbeddedFields } from "@formbricks/types/embedded-data-resolver";
import type { TResponseData, TResponseVariables } from "@formbricks/types/responses";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { evaluateSetValue } from "@formbricks/types/surveys/expression-evaluation";
import type { TExpression } from "@formbricks/types/surveys/expressions";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { formatDateForDisplay, formatDateTimeForDisplay } from "@/lib/utils/datetime";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";

/**
 * The formula box's sample result (ENG-6935): what a Set value step computes for one made-up
 * response, through the same shared evaluator the survey runs. Every answer and field gets a typical
 * value of its type, so a formula that reads them shows a real number, text or date rather than empty.
 */

const DAY_MS = 86_400_000;

const toDateOnly = (date: Date) => date.toISOString().slice(0, 10);

const sampleForDataType = (dataType: TEmbeddedDataType, name: string, now: Date): string | number => {
  switch (dataType) {
    case "number":
      return 10;
    case "date":
      return toDateOnly(new Date(now.getTime() - 30 * DAY_MS));
    case "boolean":
      return "true";
    case "string":
      return name;
  }
};

/** A made-up answer for each question a formula can read, and a value for each field. */
export const buildSampleResponse = (
  survey: TSurvey,
  now: Date
): {
  data: TResponseData;
  variables: TResponseVariables;
  reservedValues: Record<string, string | number>;
} => {
  const data: TResponseData = {};

  for (const element of getElementsFromBlocks(survey.blocks)) {
    switch (element.type) {
      case TSurveyElementTypeEnum.Rating:
        data[element.id] = Math.max(1, (element.range ?? 5) - 1);
        break;
      case TSurveyElementTypeEnum.NPS:
        data[element.id] = 8;
        break;
      case TSurveyElementTypeEnum.CSAT:
      case TSurveyElementTypeEnum.CES:
        data[element.id] = 4;
        break;
      case TSurveyElementTypeEnum.OpenText:
        data[element.id] = element.inputType === "number" ? 12 : "text";
        break;
      case TSurveyElementTypeEnum.Date:
        data[element.id] = toDateOnly(new Date(now.getTime() - 30 * DAY_MS));
        break;
      case TSurveyElementTypeEnum.MultipleChoiceSingle: {
        const first = element.choices.find((choice) => choice.id !== "other") ?? element.choices[0];
        if (first) data[element.id] = first.label.default;
        break;
      }
      default:
        break;
    }
  }

  const variables: TResponseVariables = {};
  for (const { field, link } of getSurveyEmbeddedFields(survey)) {
    const sample =
      field.defaultValue !== null && typeof field.defaultValue !== "boolean"
        ? field.defaultValue
        : sampleForDataType(field.dataType, field.name, now);
    if (field.source === "computed") variables[link.storageKey] = sample;
    else data[link.storageKey] = sample;
  }

  const reservedValues: Record<string, string | number> = {};
  for (const entry of RESERVED_FIELD_CATALOG) {
    reservedValues[entry.name] = sampleForDataType(entry.dataType, entry.name, now);
  }

  return { data, variables, reservedValues };
};

/** What the step would set the field to for the sample response: a value, or `""` for empty. */
export const getSampleResult = (
  expression: TExpression,
  targetDataType: TEmbeddedDataType,
  survey: TSurvey,
  now: Date = new Date()
): string | number => {
  const { data, variables, reservedValues } = buildSampleResponse(survey, now);
  return evaluateSetValue(expression, targetDataType, {
    survey,
    data,
    variables,
    reservedValues,
    language: "default",
    now: () => now,
  });
};

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * How a sample result reads: a date in the viewer's locale (a timestamp in their time zone, a
 * calendar date as that day), with the stored ISO value as its title; anything else as it is.
 */
export const formatSampleResult = (
  result: string | number,
  targetDataType: TEmbeddedDataType,
  locale: string,
  timeZone?: string
): { text: string; title?: string } => {
  const text = String(result);
  if (targetDataType !== "date" || typeof result !== "string") return { text };
  const date = new Date(result);
  if (Number.isNaN(date.getTime())) return { text };

  const formatted = CALENDAR_DATE.test(result)
    ? formatDateForDisplay(date, locale, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })
    : formatDateTimeForDisplay(date, locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone,
      });
  return { text: formatted, title: result };
};
