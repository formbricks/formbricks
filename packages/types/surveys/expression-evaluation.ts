import type { TEmbeddedDataType } from "../embedded-data";
import { getSurveyEmbeddedFields } from "../embedded-data-fields";
import type { TLinkedEmbeddedField } from "../embedded-data-resolver";
import type { TI18nString } from "../i18n";
import type { TResponseData, TResponseVariables } from "../responses";
import { TSurveyElementTypeEnum } from "./constants";
import { getElementExpressionType, isDateLiteral } from "./expression-types";
import { EXPRESSION_MAX_DEPTH, type TExpression, type TExpressionFunction } from "./expressions";

/**
 * The one evaluator of Set value expressions (ENG-6935, grill T8). The survey bundle
 * (`packages/surveys/src/lib/logic.ts`), the server engine (`apps/web/lib/surveyLogic/utils.ts`) and
 * the editor's sample result all call it, so a formula computes the same everywhere.
 *
 * It only walks the tree (ADR 0030): no parser, no `eval`, no `new Function`, so it runs under a
 * strict Content Security Policy.
 *
 * Behaviour (grill P3):
 * - empty in, empty out: an unanswered question or unset field makes every function empty, except
 *   `ifEmpty`, which is how a default is set;
 * - a value that isn't a number counts as empty in arithmetic, and dividing by zero gives empty;
 * - `now()` is the device clock as a UTC ISO timestamp, and `daysBetween()` counts UTC calendar days.
 */

/** An expression's value: a number, text (dates are ISO text), or `undefined` for empty. */
export type TExpressionResult = number | string | undefined;

interface TExpressionChoiceLike {
  id: string;
  label: TI18nString;
  code?: string;
}

interface TExpressionElement {
  id: string;
  type: TSurveyElementTypeEnum;
  inputType?: string;
  choices?: TExpressionChoiceLike[];
}

/** The survey slice the evaluator reads: its questions and its Embedded Data fields. */
export interface TExpressionSurvey {
  blocks: { elements: unknown[] }[];
  embeddedFields?: TLinkedEmbeddedField[] | null;
}

export interface TExpressionContext {
  survey: TExpressionSurvey;
  /** Answers and ingested values (`response.data`). */
  data: TResponseData;
  /** Computed values (`response.variables`), including those set earlier in the same flow. */
  variables: TResponseVariables;
  /** The reserved-field value map a `reserved` leaf reads, as conditions do. */
  reservedValues?: Record<string, unknown>;
  /** The respondent's language, to match a single-select label to its option. */
  language: string;
  /** The clock `now()` reads. Defaults to the device clock. */
  now?: () => Date;
}

const MS_PER_DAY = 86_400_000;

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const toText = (value: unknown): string | undefined => {
  if (typeof value === "string") return value === "" ? undefined : value;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : undefined;
  if (typeof value === "boolean") return String(value);
  return undefined;
};

const toDateText = (value: unknown): string | undefined =>
  typeof value === "string" && isDateLiteral(value) && !Number.isNaN(Date.parse(value)) ? value : undefined;

/** A stored value read as its declared type; anything that doesn't fit is empty. */
const coerce = (value: unknown, dataType: TEmbeddedDataType): TExpressionResult => {
  switch (dataType) {
    case "number":
      return toNumber(value);
    case "date":
      return toDateText(value);
    case "boolean":
    case "string":
      return toText(value);
  }
};

const findElement = (survey: TExpressionSurvey, elementId: string): TExpressionElement | undefined => {
  for (const block of survey.blocks) {
    for (const element of block.elements) {
      if ((element as TExpressionElement).id === elementId) return element as TExpressionElement;
    }
  }
  return undefined;
};

const labelIn = (label: TI18nString, language: string): string | undefined => {
  const localized = label[language];
  return typeof localized === "string" && localized.trim() !== "" ? localized : label.default;
};

/**
 * A single-select answer as its answer code (json-shapes decision B). Answers are stored as the label
 * the respondent saw, so the option is found the way the export finds it (ADR 0020): the response
 * language first, then any language. A write-in matches no option and reads as the Other option's
 * code. An option saved before codes existed reads as its position, which is what filling the missing
 * codes would give it.
 */
const getChoiceCode = (
  element: TExpressionElement,
  answer: unknown,
  language: string
): string | undefined => {
  if (typeof answer !== "string" || answer === "") return undefined;
  const choices = element.choices ?? [];
  const codeOf = (choice: TExpressionChoiceLike) => choice.code ?? String(choices.indexOf(choice) + 1);

  const inLanguage = choices.find((choice) => labelIn(choice.label, language) === answer);
  if (inLanguage) return codeOf(inLanguage);
  const inAnyLanguage = choices.find((choice) => Object.values(choice.label).includes(answer));
  if (inAnyLanguage) return codeOf(inAnyLanguage);
  const other = choices.find((choice) => choice.id === "other");
  return other ? codeOf(other) : undefined;
};

const readElement = (ctx: TExpressionContext, elementId: string): TExpressionResult => {
  const element = findElement(ctx.survey, elementId);
  if (!element) return undefined;
  const answer = ctx.data[elementId];

  if (element.type === TSurveyElementTypeEnum.MultipleChoiceSingle) {
    return getChoiceCode(element, answer, ctx.language);
  }

  switch (getElementExpressionType(element)) {
    case "number":
      return toNumber(answer);
    case "date":
      return toDateText(answer);
    case "text":
      return toText(answer);
    default:
      return undefined;
  }
};

const findField = (ctx: TExpressionContext, storageKey: string, source: "computed" | "ingested") =>
  getSurveyEmbeddedFields(ctx.survey).find(
    ({ field, link }) => link.storageKey === storageKey && field.source === source
  )?.field;

const readComputed = (ctx: TExpressionContext, storageKey: string): TExpressionResult => {
  const field = findField(ctx, storageKey, "computed");
  if (!field) return undefined;
  // A key that is there wins, even "" (a field a step cleared). Only a field never set reads its default.
  if (storageKey in ctx.variables) return coerce(ctx.variables[storageKey], field.dataType);
  return field.defaultValue === null ? undefined : coerce(field.defaultValue, field.dataType);
};

const readIngested = (ctx: TExpressionContext, storageKey: string): TExpressionResult => {
  const field = findField(ctx, storageKey, "ingested");
  const stored = ctx.data[storageKey];
  return field ? coerce(stored, field.dataType) : toText(stored);
};

/** The UTC calendar day of a date or timestamp, as a day number. */
const toUtcDay = (value: TExpressionResult): number | undefined => {
  const text = toDateText(value);
  if (text === undefined) return undefined;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return undefined;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / MS_PER_DAY;
};

/** Rounds half away from zero, to `decimals` places, without the binary drift of `x * 10 ** d`. */
const roundTo = (value: number, decimals: number): number => {
  const sign = value < 0 ? -1 : 1;
  const shifted = Number(`${String(Math.abs(value))}e${String(decimals)}`);
  const rounded = Number(`${String(Math.round(shifted))}e-${String(decimals)}`);
  // Exponent notation (1e21) doesn't take a second exponent; fall back to plain arithmetic there.
  if (!Number.isFinite(shifted) || !Number.isFinite(rounded)) {
    const factor = 10 ** decimals;
    return (sign * Math.round(Math.abs(value) * factor)) / factor;
  }
  return sign * rounded;
};

const numbersOrEmpty = (values: TExpressionResult[]): number[] | undefined => {
  const numbers = values.map(toNumber);
  return numbers.every((value): value is number => value !== undefined) ? numbers : undefined;
};

const applyFunction = (
  fn: TExpressionFunction,
  args: TExpressionResult[],
  ctx: TExpressionContext
): TExpressionResult => {
  switch (fn) {
    case "now":
      return (ctx.now ?? (() => new Date()))().toISOString();
    case "ifEmpty":
      return args[0] === undefined || args[0] === "" ? args[1] : args[0];
    case "concat":
      return args.every((value) => value !== undefined)
        ? args.map((value) => toText(value) ?? "").join("")
        : undefined;
    case "daysBetween": {
      const [from, to] = args.map(toUtcDay);
      return from === undefined || to === undefined ? undefined : to - from;
    }
  }

  const numbers = numbersOrEmpty(fn === "round" ? args.slice(0, 1) : args);
  if (!numbers || numbers.length === 0) return undefined;

  let result: number;
  switch (fn) {
    case "add":
      result = numbers.reduce((sum, value) => sum + value, 0);
      break;
    case "subtract":
      result = numbers[0] - numbers[1];
      break;
    case "multiply":
      result = numbers.reduce((product, value) => product * value, 1);
      break;
    case "divide":
      if (numbers[1] === 0) return undefined;
      result = numbers[0] / numbers[1];
      break;
    case "round":
      result = roundTo(numbers[0], toNumber(args[1]) ?? 0);
      break;
    case "min":
      result = Math.min(...numbers);
      break;
    case "max":
      result = Math.max(...numbers);
      break;
    case "abs":
      result = Math.abs(numbers[0]);
      break;
  }
  return Number.isFinite(result) ? result : undefined;
};

const evaluate = (node: TExpression, ctx: TExpressionContext, depth: number): TExpressionResult => {
  // Trees are bounded at save; this only keeps a malformed stored tree from recursing without end.
  if (depth > EXPRESSION_MAX_DEPTH) return undefined;

  switch (node.type) {
    case "static":
      return node.value;
    case "element":
      return readElement(ctx, node.value);
    case "variable":
      return readComputed(ctx, node.value);
    case "hiddenField":
      return readIngested(ctx, node.value);
    case "reserved": {
      const value = ctx.reservedValues?.[node.value];
      return typeof value === "number" ? toNumber(value) : toText(value);
    }
    case "call":
      return applyFunction(
        node.fn,
        node.args.map((arg) => evaluate(arg, ctx, depth + 1)),
        ctx
      );
  }
};

/** Evaluates an expression tree; `undefined` means empty. */
export const evaluateExpression = (expression: TExpression, ctx: TExpressionContext): TExpressionResult =>
  evaluate(expression, ctx, 1);

/**
 * What a Set value step writes into `response.variables` for a field of `dataType`: the result as
 * that type, or `""` when it is empty or doesn't fit. `""` rather than a missing key because a
 * response update merges `variables`, so only a value can overwrite the one already stored; every
 * reader treats `""` as unset (the export's coercion, the resolver and this evaluator).
 */
export const evaluateSetValue = (
  expression: TExpression,
  dataType: TEmbeddedDataType,
  ctx: TExpressionContext
): number | string => coerce(evaluateExpression(expression, ctx), dataType) ?? "";
