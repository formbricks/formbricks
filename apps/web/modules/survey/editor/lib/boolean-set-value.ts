import type { TSurveyBlockLogicAction } from "@formbricks/types/surveys/blocks";

type TCalculateValue = Extract<TSurveyBlockLogicAction, { objective: "calculate" }>["value"];

/** What a true/false Set value may store: True, False, or another true/false field (ENG-6973). */
export type TBooleanSetValue =
  | { type: "static"; value: boolean }
  | { type: "variable" | "hiddenField"; value: string };

/**
 * The option a true/false Set value row's dropdown shows as picked: `"true"` / `"false"` for a static
 * value (the option values `getActionValueOptions` offers), the storage key for a field, and nothing
 * for what the row cannot show (an empty new step, or a value of another type).
 */
export const getBooleanSetValueSelection = (value: TCalculateValue): string => {
  if (value.type === "static") return typeof value.value === "boolean" ? String(value.value) : "";
  if (value.type === "variable" || value.type === "hiddenField") return value.value;
  return "";
};

/**
 * The value a pick from that dropdown stores. True and False are stored as real booleans, a field as
 * its reference. A pick of anything else (there is no free text on this row) stores nothing.
 */
export const toBooleanSetValue = (
  picked: string | number | string[],
  optionType: string | undefined
): TBooleanSetValue | undefined => {
  if (optionType === "static") {
    if (picked === "true") return { type: "static", value: true };
    if (picked === "false") return { type: "static", value: false };
    return undefined;
  }
  if ((optionType === "variable" || optionType === "hiddenField") && typeof picked === "string") {
    return { type: optionType, value: picked };
  }
  return undefined;
};
