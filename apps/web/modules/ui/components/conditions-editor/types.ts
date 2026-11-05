import type { ReactNode } from "react";
import { TConnector } from "@formbricks/types/surveys/logic";
import { TComboboxGroupedOption, TComboboxOption } from "@/modules/ui/components/input-combo-box";

export interface TGenericCondition {
  id: string;
  leftOperand: {
    value: string;
    type: string;
    meta?: Record<string, unknown>;
  };
  operator: string;
  rightOperand?: {
    value: string | number | string[];
    type: string;
  };
}

export interface TGenericConditionGroup<T extends TGenericCondition = TGenericCondition> {
  id: string;
  connector: TConnector;
  conditions: (T | TGenericConditionGroup<T>)[];
}

/**
 * How the editor lays its conditions out. `default` is every shared caller's (quotas, chart filters,
 * the table Advanced filter, show conditions). `sentence` is the survey rule editor's and the Flow
 * tab's show-if popovers' (ENG-6969 T6): "If … and …", the and/or in a select before the second
 * condition, one aligned grid, borderless row actions, and an empty first field read as a placeholder.
 */
export type TConditionsEditorVariant = "default" | "sentence";

export interface TConditionValueProps {
  show?: boolean;
  options: TComboboxGroupedOption[];
  showInput?: boolean;
  inputType?: string;
}

export interface TConditionsEditorCallbacks<T extends TGenericCondition = TGenericCondition> {
  onAddConditionBelow: (resourceId: string) => void;
  onRemoveCondition: (resourceId: string) => void;
  onDuplicateCondition: (resourceId: string) => void;
  onCreateGroup?: (resourceId: string) => void;
  onUpdateCondition: (resourceId: string, updates: Partial<T>) => void;
  onToggleGroupConnector: (groupId: string) => void;
}

export interface TConditionsEditorConfig<T extends TGenericCondition = TGenericCondition> {
  getLeftOperandOptions: () => TComboboxGroupedOption[];
  getOperatorOptions: (condition: T) => TComboboxOption[];
  getValueProps: (condition: T) => TConditionValueProps;
  getDefaultOperator: () => string;
  formatLeftOperandValue: (condition: T) => string;
  /**
   * The right operand as the value picker shows it, when it isn't the stored value as it is: a matrix
   * row condition reads its column ids back to the positions its options use (ENG-6934). Omitted means
   * the stored value.
   */
  formatRightOperandValue?: (condition: T) => string | number | string[] | undefined;
  /**
   * Renders the right-operand control for a condition when the default combobox does not fit —
   * a date picker, or a pick-list fetched per data source. Return `undefined` to fall back to the
   * combobox described by `getValueProps`, `null` to render nothing (a valueless operator).
   */
  renderValueInput?: (condition: T) => ReactNode | undefined;
  /**
   * Whether a condition at this nesting depth (0 = the top level) may be wrapped in a new group.
   * Omitted means always, as long as `onCreateGroup` is given; a caller with a depth limit says no here.
   */
  canCreateGroup?: (depth: number) => boolean;
  /**
   * Whether a lone first condition reads "When". Survey logic says it (when this holds, do that); a
   * table filter has nothing to trigger, so it leaves the slot empty. Omitted means shown.
   */
  showWhenLabel?: boolean;
  /** Lets the first operand's list grow past its field and wrap long names (survey questions). */
  wideLeftOperandDropdown?: boolean;
}
