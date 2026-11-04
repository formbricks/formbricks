import type { TEmbeddedDataType } from "../embedded-data";
import { TSurveyElementTypeEnum } from "./constants";
import { type TExpression, type TExpressionFunction, isExpressionOverLimits } from "./expressions";

/**
 * The types of Set value expressions (ENG-6935): what each leaf and each function yields, and the
 * save-time check that refuses text in arithmetic, a missing reference or a result that doesn't fit
 * its target, each with its exact path into the tree.
 *
 * Kept free of zod and of the survey schema so the survey bundle can import the element mapping
 * the evaluator shares with it.
 */

export type TExpressionValueType = "number" | "text" | "date" | "boolean";

/** The slice of an element the type of its answer depends on. */
export interface TExpressionElementLike {
  type: TSurveyElementTypeEnum;
  inputType?: string;
}

/**
 * What an answer is inside an expression, or `undefined` for a question type a formula can't use:
 * rating, NPS, CSAT, CES and number open text are numbers, other open text is text, a date question
 * is a date, and a single select yields its answer code as text (json-shapes decision B).
 */
export const getElementExpressionType = (
  element: TExpressionElementLike
): TExpressionValueType | undefined => {
  switch (element.type) {
    case TSurveyElementTypeEnum.Rating:
    case TSurveyElementTypeEnum.NPS:
    case TSurveyElementTypeEnum.CSAT:
    case TSurveyElementTypeEnum.CES:
      return "number";
    case TSurveyElementTypeEnum.OpenText:
      return element.inputType === "number" ? "number" : "text";
    case TSurveyElementTypeEnum.Date:
      return "date";
    case TSurveyElementTypeEnum.MultipleChoiceSingle:
      return "text";
    default:
      return undefined;
  }
};

/** An Embedded Data field's `dataType` as an expression type. */
export const getDataTypeExpressionType = (dataType: TEmbeddedDataType): TExpressionValueType =>
  dataType === "string" ? "text" : dataType;

/** The field type a computed target holds, as an expression type. */
export const EXPRESSION_TARGET_TYPES: readonly TEmbeddedDataType[] = ["number", "string", "date"];

/** A date literal: `2026-03-01` or a full ISO timestamp. Text otherwise. */
export const DATE_LITERAL_PATTERN =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?$/;

/** What a reference resolves to while checking: its type, `"unsupported"`, or `undefined` if it doesn't exist. */
export interface TExpressionTypeContext {
  getElement: (elementId: string) => TExpressionElementLike | undefined;
  getComputedFieldType: (storageKey: string) => TEmbeddedDataType | undefined;
  getIngestedFieldType: (storageKey: string) => TEmbeddedDataType | undefined;
  /** A reserved name the catalog doesn't know reads as text (forward compatible, as in conditions). */
  getReservedFieldType: (name: string) => TEmbeddedDataType | undefined;
}

/**
 * What an issue is, for a UI that words it in the author's language. `message` stays the English text
 * the API and MCP report; `params` holds the values a translated message needs (types as their
 * expression type names: number, text, date, boolean).
 */
export type TExpressionTypeIssueCode =
  | "unknown_question"
  | "unusable_question"
  | "unknown_field"
  | "needs_numbers"
  | "needs_type"
  | "fallback_mismatch"
  | "empty"
  | "target_not_formula"
  | "result_mismatch";

export interface TExpressionTypeIssue {
  path: (string | number)[];
  message: string;
  code: TExpressionTypeIssueCode;
  params?: Record<string, string>;
}

type TInferred = { type: TExpressionValueType; dateLiteral?: boolean } | undefined;

const FUNCTION_LABEL: Record<TExpressionFunction, string> = {
  add: "+",
  subtract: "−",
  multiply: "×",
  divide: "÷",
  round: "round()",
  min: "min()",
  max: "max()",
  abs: "abs()",
  ifEmpty: "ifEmpty()",
  concat: "concat()",
  now: "now()",
  daysBetween: "daysBetween()",
};

const NUMBER_FUNCTIONS = new Set<TExpressionFunction>([
  "add",
  "subtract",
  "multiply",
  "divide",
  "round",
  "min",
  "max",
  "abs",
]);

const fits = (inferred: TInferred, wanted: TExpressionValueType): boolean =>
  inferred !== undefined &&
  (inferred.type === wanted ||
    (wanted === "date" && inferred.type === "text" && inferred.dateLiteral === true));

const describeType = (type: TExpressionValueType): string => (type === "boolean" ? "true/false" : type);

/**
 * Infers the type of `expression` and collects every type problem with its path, relative to the
 * expression's root. A node whose type can't be known (a missing reference) reports once and is then
 * skipped by its parent, so one mistake doesn't cascade into a page of errors.
 */
export const checkExpressionTypes = (
  expression: TExpression,
  ctx: TExpressionTypeContext
): { type: TExpressionValueType | undefined; dateLiteral: boolean; issues: TExpressionTypeIssue[] } => {
  const issues: TExpressionTypeIssue[] = [];

  const infer = (node: TExpression, path: (string | number)[]): TInferred => {
    switch (node.type) {
      case "static":
        if (typeof node.value === "number") return { type: "number" };
        return { type: "text", dateLiteral: DATE_LITERAL_PATTERN.test(node.value) };
      case "element": {
        const element = ctx.getElement(node.value);
        if (!element) {
          issues.push({
            path: [...path, "value"],
            message: `Expression: question ${node.value} does not exist`,
            code: "unknown_question",
            params: { id: node.value },
          });
          return undefined;
        }
        const type = getElementExpressionType(element);
        if (!type) {
          issues.push({
            path: [...path, "value"],
            message: `Expression: a ${element.type} question can't be used in a formula`,
            code: "unusable_question",
            params: { questionType: element.type },
          });
          return undefined;
        }
        return { type };
      }
      case "variable": {
        const dataType = ctx.getComputedFieldType(node.value);
        if (!dataType) {
          issues.push({
            path: [...path, "value"],
            message: `Expression: field ${node.value} does not exist`,
            code: "unknown_field",
            params: { id: node.value },
          });
          return undefined;
        }
        return { type: getDataTypeExpressionType(dataType) };
      }
      case "hiddenField": {
        const dataType = ctx.getIngestedFieldType(node.value);
        if (!dataType) {
          issues.push({
            path: [...path, "value"],
            message: `Expression: field ${node.value} does not exist`,
            code: "unknown_field",
            params: { id: node.value },
          });
          return undefined;
        }
        return { type: getDataTypeExpressionType(dataType) };
      }
      case "reserved":
        return { type: getDataTypeExpressionType(ctx.getReservedFieldType(node.value) ?? "string") };
      case "call":
        return inferCall(node.fn, node.args, path);
    }
  };

  const inferCall = (fn: TExpressionFunction, args: TExpression[], path: (string | number)[]): TInferred => {
    const argTypes = args.map((arg, idx) => infer(arg, [...path, "args", idx]));
    const expect = (idx: number, wanted: TExpressionValueType): boolean => {
      const argType = argTypes[idx];
      if (argType === undefined) return false;
      if (fits(argType, wanted)) return true;
      issues.push({
        path: [...path, "args", idx],
        message:
          wanted === "number"
            ? `Expression: ${FUNCTION_LABEL[fn]} needs numbers, got ${describeType(argType.type)}`
            : `Expression: ${FUNCTION_LABEL[fn]} needs a ${describeType(wanted)}, got ${describeType(argType.type)}`,
        code: wanted === "number" ? "needs_numbers" : "needs_type",
        params: { fn: FUNCTION_LABEL[fn], wanted, got: argType.type },
      });
      return false;
    };

    if (NUMBER_FUNCTIONS.has(fn)) {
      // round's decimals are checked by the schema; only its first argument is a value.
      const valueArgs = fn === "round" ? [0] : args.map((_, idx) => idx);
      const ok = valueArgs.map((idx) => expect(idx, "number")).every(Boolean);
      return ok ? { type: "number" } : undefined;
    }

    switch (fn) {
      case "daysBetween": {
        const ok = [expect(0, "date"), expect(1, "date")].every(Boolean);
        return ok ? { type: "number" } : undefined;
      }
      case "now":
        return { type: "date" };
      case "concat":
        return argTypes.every((argType) => argType !== undefined) ? { type: "text" } : undefined;
      case "ifEmpty": {
        const [value, fallback] = argTypes;
        if (!value || !fallback) return undefined;
        if (value.type === fallback.type) return { type: value.type };
        // A date with a fixed fallback date (`ifEmpty(@signup, "2026-01-01")`) stays a date.
        if (fits(fallback, value.type)) return { type: value.type };
        if (fits(value, fallback.type)) return { type: fallback.type };
        issues.push({
          path: [...path, "args", 1],
          message: `Expression: ifEmpty()'s fallback must be a ${describeType(value.type)}, got ${describeType(fallback.type)}`,
          code: "fallback_mismatch",
          params: { wanted: value.type, got: fallback.type },
        });
        return undefined;
      }
      default:
        return undefined;
    }
  };

  const inferred = infer(expression, []);
  return { type: inferred?.type, dateLiteral: inferred?.dateLiteral === true, issues };
};

/**
 * The full save-time check of a Set value step: the expression's own types, then whether its result
 * fits the target field (number, text or date; a fixed date text fits a date field).
 */
export const getSetValueExpressionIssues = (
  expression: TExpression,
  targetDataType: TEmbeddedDataType,
  ctx: TExpressionTypeContext
): TExpressionTypeIssue[] => {
  if (expression.type === "static" && expression.value === "") {
    return [{ path: [], message: "Expression: enter a formula", code: "empty" }];
  }
  // Refused by the schema at its path; checking its types would descend the whole hostile tree.
  if (isExpressionOverLimits(expression)) return [];

  const { type, dateLiteral, issues } = checkExpressionTypes(expression, ctx);
  if (issues.length > 0 || type === undefined) return issues;

  if (!EXPRESSION_TARGET_TYPES.includes(targetDataType)) {
    return [
      {
        path: [],
        message: `Expression: a ${targetDataType} field can't be set with a formula`,
        code: "target_not_formula",
        params: { fieldType: getDataTypeExpressionType(targetDataType) },
      },
    ];
  }

  const wanted = getDataTypeExpressionType(targetDataType);
  if (!fits({ type, dateLiteral }, wanted)) {
    return [
      {
        path: [],
        message: `Expression: the result is ${describeType(type)}, but the field holds ${describeType(wanted)}`,
        code: "result_mismatch",
        params: { got: type, wanted },
      },
    ];
  }
  return [];
};
