import type { TResponseData, TResponseVariables } from "../responses";

/** The parts of a one-step calculate action its operand is read from. */
interface TOneStepOperandAction {
  value: { type: string; value: unknown };
}

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
  dataType: string;
}

/**
 * Whether an answer, passed-in field or reserved field reads as a number. Blank text is not one:
 * `Number("")` is 0, which would turn an empty field into a real 0 and stop an `isSkipped` condition
 * from seeing it.
 */
const isNumericOperand = (value: string | number): boolean =>
  typeof value === "number" || (value.trim() !== "" && !Number.isNaN(Number(value)));

/** A read field as an operand: text or a number, numeric text as a number for a `number` target. */
const asOperand = (value: unknown, dataType: string): string | number | undefined => {
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  return dataType === "number" && isNumericOperand(value) ? Number(value) : value;
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
 * viewed, say) wrote nothing. It reads `reservedValues`, the same map the expression form reads.
 */
export const getOneStepOperand = (
  action: TOneStepOperandAction,
  { data, variables, reservedValues, dataType }: TOneStepOperandSources
): string | number | undefined => {
  const { type, value } = action.value;

  switch (type) {
    case "static":
      return typeof value === "string" || typeof value === "number" ? value : undefined;
    case "variable": {
      if (typeof value !== "string") return undefined;
      const variable = variables[value];
      return typeof variable === "number" || typeof variable === "string" ? variable : undefined;
    }
    case "element":
    case "hiddenField":
      return typeof value === "string" ? asOperand(data[value], dataType) : undefined;
    case "reserved":
      return typeof value === "string" ? asOperand(reservedValues?.[value], dataType) : undefined;
    default:
      return undefined;
  }
};
