import { getOperatorForField } from "@/modules/ui/components/conditions-editor/lib/sentence";
import type {
  TConditionsEditorCallbacks,
  TConditionsEditorConfig,
  TGenericCondition,
} from "@/modules/ui/components/conditions-editor/types";
import type { TComboboxOption } from "@/modules/ui/components/input-combo-box";

/** The operators whose value is a list: the value picker allows several and shows check marks. */
const MULTI_SELECT_OPERATORS: ReadonlySet<string> = new Set([
  "equalsOneOf",
  "includesAllOf",
  "includesOneOf",
  "doesNotIncludeOneOf",
  "doesNotIncludeAllOf",
  "isAnyOf",
]);

export const isMultiSelectOperator = (operator: string): boolean => MULTI_SELECT_OPERATORS.has(operator);

/** A condition's right-hand value, as the combobox hands it over. */
export type TConditionValue = string | number | string[];

/**
 * What a condition row does when its field, operator or value changes, for both layouts of the
 * conditions editor (default and sentence).
 */
export const createConditionHandlers = (
  config: Pick<TConditionsEditorConfig, "getOperatorOptions" | "getDefaultOperator">,
  callbacks: Pick<TConditionsEditorCallbacks, "onUpdateCondition">
) => ({
  /**
   * A new field resets the operator and the value. The operator is the editor's default when the
   * field offers it, else the field's first (`getOperatorForField`): a hidden field or a variable
   * needn't offer the default, which is a question's.
   */
  handleLeftOperandChange: (condition: TGenericCondition, value: string, option?: TComboboxOption) => {
    const leftOperand = { value, type: option?.meta?.type || "static", meta: option?.meta };
    const operator = getOperatorForField(
      config.getOperatorOptions({ ...condition, leftOperand, rightOperand: undefined }),
      config.getDefaultOperator()
    );
    callbacks.onUpdateCondition(condition.id, { leftOperand, operator, rightOperand: undefined });
  },

  /** A new operator clears the value; picking the current one changes nothing. */
  handleOperatorChange: (condition: TGenericCondition, value: string) => {
    if (value !== condition.operator) {
      callbacks.onUpdateCondition(condition.id, { operator: value, rightOperand: undefined });
    }
  },

  handleRightOperandChange: (
    condition: TGenericCondition,
    value: TConditionValue,
    option?: TComboboxOption
  ) => {
    callbacks.onUpdateCondition(condition.id, {
      rightOperand: { value, type: option?.meta?.type || "static" },
    });
  },
});
