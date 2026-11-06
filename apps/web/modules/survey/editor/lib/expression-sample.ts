import type { TEmbeddedDataType } from "@formbricks/types/embedded-data";
import { RESERVED_FIELD_CATALOG, getSurveyEmbeddedFields } from "@formbricks/types/embedded-data-resolver";
import type { TResponseData, TResponseVariables } from "@formbricks/types/responses";
import { type TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { evaluateExpression, evaluateSetValue } from "@formbricks/types/surveys/expression-evaluation";
import { type TExpressionValueType, checkExpressionTypes } from "@formbricks/types/surveys/expression-types";
import type { TExpression } from "@formbricks/types/surveys/expressions";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { formatStoredDateValue } from "@/lib/utils/datetime";
import {
  formatFormula,
  getFormulaReferences,
  getFormulaTypeContext,
} from "@/modules/survey/editor/lib/expression-formula";
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

/** A made-up answer to a question a formula can read; `undefined` for one it cannot. */
const sampleAnswer = (element: TSurveyElement, now: Date): string | number | undefined => {
  switch (element.type) {
    case TSurveyElementTypeEnum.Rating:
      return Math.max(1, (element.range ?? 5) - 1);
    case TSurveyElementTypeEnum.NPS:
      return 8;
    case TSurveyElementTypeEnum.CSAT:
    case TSurveyElementTypeEnum.CES:
      return 4;
    case TSurveyElementTypeEnum.OpenText:
      return element.inputType === "number" ? 12 : "text";
    case TSurveyElementTypeEnum.Date:
      return toDateOnly(new Date(now.getTime() - 30 * DAY_MS));
    case TSurveyElementTypeEnum.MultipleChoiceSingle: {
      const first = element.choices.find((choice) => choice.id !== "other") ?? element.choices[0];
      return first?.label.default;
    }
    default:
      return undefined;
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
    const answer = sampleAnswer(element, now);
    if (answer !== undefined) data[element.id] = answer;
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
): string | number => getSampleExplanation(expression, targetDataType, survey, now).result;

/** An answer or field the formula reads, and the value the sample response gives it (ENG-6950). */
export interface TSampleInput {
  /** The reference as the formula box writes it: `@sat_netflix`. */
  name: string;
  value: string | number | undefined;
  valueType: TExpressionValueType | undefined;
}

type TReferenceLeaf = Exclude<TExpression, { type: "call" | "static" }>;

/** Each answer and field the expression reads, once, in the order the formula names them. */
const collectLeaves = (expression: TExpression): TReferenceLeaf[] => {
  const seen = new Set<string>();
  const leaves: TReferenceLeaf[] = [];
  const visit = (node: TExpression) => {
    if (node.type === "call") {
      node.args.forEach(visit);
      return;
    }
    if (node.type === "static") return;
    const key = `${node.type}:${node.value}`;
    if (seen.has(key)) return;
    seen.add(key);
    leaves.push(node);
  };
  visit(expression);
  return leaves;
};

/**
 * The sample result with its inputs spelled out (ENG-6950): "If @sat_netflix is 4 and @sat_disney is
 * 4, the result is 12". Each input is read through the same evaluator the result is, so a single
 * select shows the answer code a formula sees, not its label.
 */
export const getSampleExplanation = (
  expression: TExpression,
  targetDataType: TEmbeddedDataType,
  survey: TSurvey,
  now: Date = new Date()
): { inputs: TSampleInput[]; result: string | number } => {
  const { data, variables, reservedValues } = buildSampleResponse(survey, now);
  const ctx = { survey, data, variables, reservedValues, language: "default", now: () => now };
  const references = getFormulaReferences(survey);
  const typeContext = getFormulaTypeContext(survey);
  const inputs = collectLeaves(expression).map((leaf) => ({
    name: formatFormula(leaf, references),
    value: evaluateExpression(leaf, ctx),
    valueType: checkExpressionTypes(leaf, typeContext).type,
  }));
  return { inputs, result: evaluateSetValue(expression, targetDataType, ctx) };
};

/**
 * An input's sample value as the sentence reads it: text in quotes, a date in the app's date format,
 * a number as it is, `undefined` for empty.
 */
export const formatSampleInput = (
  input: TSampleInput,
  locale: string,
  timeZone?: string
): string | undefined => {
  if (input.value === undefined || input.value === "") return undefined;
  if (typeof input.value === "number") return String(input.value);
  if (input.valueType === "date") return formatStoredDateValue(input.value, locale, timeZone) ?? input.value;
  return `“${input.value}”`;
};

/**
 * How a sample result reads: a date in the app's date format (P65; a timestamp with its time in the
 * viewer's time zone, a calendar date as that day), with the stored ISO value as its title; anything
 * else as it is.
 */
export const formatSampleResult = (
  result: string | number,
  targetDataType: TEmbeddedDataType,
  locale: string,
  timeZone?: string
): { text: string; title?: string } => {
  const text = String(result);
  if (targetDataType !== "date" || typeof result !== "string") return { text };
  const formatted = formatStoredDateValue(result, locale, timeZone);
  return formatted === null ? { text } : { text: formatted, title: result };
};
