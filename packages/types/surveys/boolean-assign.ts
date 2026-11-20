import type { TEmbeddedDataType } from "../embedded-data";
import { coerceToEmbeddedDataType } from "../embedded-data-resolver";
import type { TResponseData, TResponseVariables } from "../responses";

/** The parts of a calculate action a true/false Set value reads. */
interface TBooleanAssignAction {
  operator: string;
  value: { type: string; value: unknown };
}

/**
 * Set value on a true/false field (ENG-6973), shared by both logic engines: the survey bundle
 * (`packages/surveys/src/lib/logic.ts`) and the server (`apps/web/lib/surveyLogic/utils.ts`).
 *
 * A static `true` / `false` is written as is. A reference copies another true/false field: a
 * calculated one from `variables`, a passed-in one from `data`, where it arrives as `"true"` /
 * `"false"` and is normalized to the boolean. An unset or unreadable source returns `undefined`, so
 * the target stays as it is, as an empty source leaves a field of any other type. Anything but a
 * one-step assign returns `undefined` too: the survey schema refuses it before it can run.
 */
export const evaluateBooleanAssign = (
  action: TBooleanAssignAction,
  data: TResponseData,
  variables: TResponseVariables
): boolean | undefined => {
  if (action.operator !== "assign") return undefined;
  const { type, value } = action.value;

  let source: unknown;
  if (type === "static") {
    if (typeof value !== "boolean") return undefined;
    source = value;
  } else if (type === "variable" && typeof value === "string") {
    source = variables[value];
  } else if (type === "hiddenField" && typeof value === "string") {
    source = data[value];
  } else {
    return undefined;
  }

  const coerced = coerceToEmbeddedDataType(source, "boolean");
  return typeof coerced === "boolean" ? coerced : undefined;
};

/** The `dataType` of a survey's computed or ingested field by storage key, `undefined` when it has none. */
export type TBooleanAssignFieldTypeLookup = (
  storageKey: string,
  source: "computed" | "ingested"
) => TEmbeddedDataType | undefined;

/**
 * Whether a Set value on a true/false field is one the engines run (ENG-6973): a one-step `assign` of
 * a static `true` / `false`, or a `variable` / `hiddenField` reference to another true/false field.
 * Any other operator, value or an expression is refused. The one rule shared by the block and start
 * logic refinements and the v3 dry run, so a save and a validate refuse the same steps.
 */
export const isValidBooleanAssign = (
  action: TBooleanAssignAction,
  getFieldType: TBooleanAssignFieldTypeLookup
): boolean => {
  if (action.operator !== "assign") return false;
  const { type, value } = action.value;
  if (type === "static") return typeof value === "boolean";
  if (typeof value !== "string") return false;
  if (type === "variable") return getFieldType(value, "computed") === "boolean";
  if (type === "hiddenField") return getFieldType(value, "ingested") === "boolean";
  return false;
};

export const BOOLEAN_ASSIGN_MESSAGE = "A true/false field is set to True, False or another true/false field";

/**
 * Whether a Set value is a static True or False, which only a true/false field takes. Shared by the
 * same three checks as {@link isValidBooleanAssign}, which refuse it on a field of any other type
 * with {@link BOOLEAN_VALUE_TARGET_MESSAGE}.
 */
export const isStaticBooleanValue = (value: TBooleanAssignAction["value"]): boolean =>
  value.type === "static" && typeof value.value === "boolean";

export const BOOLEAN_VALUE_TARGET_MESSAGE = "True or False can only be set on a true/false field";
