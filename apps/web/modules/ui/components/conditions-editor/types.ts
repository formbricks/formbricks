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
   * Renders the right-operand control for a condition when the default combobox does not fit —
   * a date picker, or a pick-list fetched per data source. Return `undefined` to fall back to the
   * combobox described by `getValueProps`, `null` to render nothing (a valueless operator).
   */
  renderValueInput?: (condition: T) => ReactNode | undefined;
}
