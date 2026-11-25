import type { TEmbeddedDataType } from "../embedded-data";
import { coerceToEmbeddedDataType } from "../embedded-data-resolver";
import type { TResponseData, TResponseVariables } from "../responses";
import type { TActionCalculate as TBlockActionCalculate } from "./blocks";
import type { TActionCalculate as TLegacyActionCalculate } from "./types";

/**
 * Every operand a one-step Set value can carry, from the schemas themselves (block logic and the legacy
 * question logic), so an operand kind added there fails the exhaustive switch below at compile time
 * instead of being ignored at run time. Type-only: nothing is bundled.
 */
export type TOneStepOperandValue = Exclude<
  (TBlockActionCalculate | TLegacyActionCalculate)["value"],
  { type: "expression" }
>;

/** What a one-step operand reads besides the action: the run's answers, fields and metadata. */
export interface TOneStepOperandSources {
  /** Answers and passed-in (hidden) fields, by id. */
  data: TResponseData;
  /** Calculated fields so far, by id. */
  variables: TResponseVariables;
  /**
   * Reserved (metadata) fields the evaluator has, by catalog name (ENG-1840). The survey bundle passes
   * the client-available entries; a name it does not have reads as unset.
   */
  reservedValues?: TResponseData;
  /** The target field's data type: a `number` target reads a numeric text operand as a number. */
  dataType: TEmbeddedDataType;
}

/**
 * Whether an answer, passed-in field or reserved field reads as a number. Blank text is not one:
 * `Number("")` is 0, which would turn an empty field into a real 0 and stop an `isSkipped` condition
 * from seeing it.
 */
const isNumericOperand = (value: string | number): boolean =>
  typeof value === "number" || (value.trim() !== "" && !Number.isNaN(Number(value)));

/**
 * An answer or passed-in field as an operand: text or a number, numeric text as a number for a `number`
 * target. A value that is, or reads as, a number that is not finite (`"1e999"`) is nothing to apply, as
 * the formula form reads it as empty; other text keeps its text, as it always has.
 */
const asOperand = (value: unknown, dataType: TEmbeddedDataType): string | number | undefined => {
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  if (dataType !== "number" || !isNumericOperand(value)) {
    return typeof value === "number" && !Number.isFinite(value) ? undefined : value;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

/**
 * A reserved field as an operand, coerced to the target's type by the same rule every other reserved read
 * uses (`coerceToEmbeddedDataType`): a number target takes only a finite number or numeric text, so a URL
 * or a timestamp is nothing to apply rather than NaN in the response; a text target takes text, a number
 * as its text and true/false as "true"/"false", as the formula form stores them.
 */
const asReservedOperand = (value: unknown, dataType: TEmbeddedDataType): string | number | undefined => {
  const coerced = coerceToEmbeddedDataType(value, dataType);
  return typeof coerced === "string" || typeof coerced === "number" ? coerced : undefined;
};

/**
 * The value a one-step Set value applies (add, subtract, multiply, divide, assign, concat), shared by
 * both logic engines: the survey bundle (`packages/surveys/src/lib/logic.ts`) and the server
 * (`apps/web/lib/surveyLogic/utils.ts`), so they cannot read an operand differently.
 *
 * `undefined` means there is nothing to apply, so the target keeps its value: a reference to a field
 * the run does not have (a stale id, a reserved field this evaluator cannot see) never manufactures a
 * 0 or an empty text. True and False belong to a true/false target and are handled by
 * `evaluateBooleanAssign`, so a boolean static is not an operand here. A legacy `"question"` operand
 * (normalized away at the API boundary) stays unresolved, as it always has.
 *
 * ENG-7431: a reserved operand (`{ type: "reserved", value: <catalog name> }`) was accepted by the
 * survey schema but read by neither engine, so an API- or MCP-built Set value from metadata (pages
 * viewed, say) wrote nothing. It reads `reservedValues`, the same map the expression form reads, by the
 * catalog's exact name (`visitPagesViewed`, not `visitpagesviewed`).
 */
export const getOneStepOperand = (
  operand: TOneStepOperandValue,
  { data, variables, reservedValues, dataType }: TOneStepOperandSources
): string | number | undefined => {
  // The types say what a parsed survey holds; the runtime checks below hold for one that was not
  // re-parsed (a stored or cached survey, a bundle older than the schema), so a malformed operand is
  // nothing to apply rather than an object written into a field.
  switch (operand.type) {
    case "static":
      return typeof operand.value === "string" || typeof operand.value === "number"
        ? operand.value
        : undefined;
    case "variable": {
      if (typeof operand.value !== "string") return undefined;
      const variable = variables[operand.value];
      return typeof variable === "number" || typeof variable === "string" ? variable : undefined;
    }
    case "element":
    case "hiddenField":
      return typeof operand.value === "string" ? asOperand(data[operand.value], dataType) : undefined;
    case "reserved":
      return typeof operand.value === "string"
        ? asReservedOperand(reservedValues?.[operand.value], dataType)
        : undefined;
    case "question":
      return undefined;
    default: {
      // Compile time: an operand kind added to the schema must be handled here (ENG-7431).
      const unhandled: never = operand;
      void unhandled;
      return undefined;
    }
  }
};
