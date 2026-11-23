"use client";

import { useTranslation } from "react-i18next";
import { TSurveyBlockLogicAction } from "@formbricks/types/surveys/blocks";
import type { TExpression } from "@formbricks/types/surveys/expressions";
import { TSurvey } from "@formbricks/types/surveys/types";
import {
  getBooleanSetValueSelection,
  toBooleanSetValue,
} from "@/modules/survey/editor/lib/boolean-set-value";
import { getActionValueOptions } from "@/modules/survey/editor/lib/utils";
import { InputCombobox } from "@/modules/ui/components/input-combo-box";

type TCalculateAction = Extract<TSurveyBlockLogicAction, { objective: "calculate" }>;

interface SetValueOneStepValueProps {
  readonly id: string;
  readonly action: TCalculateAction;
  readonly localSurvey: TSurvey;
  /** Where the rule runs, as in `LogicEditorActions`: values come from that block and earlier ones. */
  readonly scopeBlockIdx: number;
  /** The type of the field the step writes; `undefined` until one is picked. */
  readonly fieldType: "text" | "number" | "date" | "boolean" | undefined;
  /** A date field's one-step row, whose value is stored as an expression's leaf (P38). */
  readonly isDateOneStep: boolean;
  readonly onChange: (values: Partial<TSurveyBlockLogicAction>) => void;
}

/** What a date field's one-step row shows: the day, or the answer or field it copies. */
const getOneStepDateValue = (expression: TExpression): string | number =>
  expression.type === "call" ? "" : expression.value;

/** What the value box shows as picked or typed. */
const getValueSelection = (action: TCalculateAction, isBoolean: boolean): string | number => {
  if (isBoolean) return getBooleanSetValueSelection(action.value);
  // A date field's one step is the expression's leaf (P38).
  if (action.value.type === "expression") return getOneStepDateValue(action.value.value);
  const { value } = action.value;
  return typeof value === "boolean" ? String(value) : value;
};

/**
 * The value box of a one-step Set value row: free text or a pick from the answers and fields the
 * step can read. A true/false field (ENG-6973) picks True, False or another true/false field from
 * the dropdown only.
 */
export function SetValueOneStepValue({
  id,
  action,
  localSurvey,
  scopeBlockIdx,
  fieldType,
  isDateOneStep,
  onChange,
}: SetValueOneStepValueProps) {
  const { t } = useTranslation();
  const isBoolean = fieldType === "boolean";
  const placeholder = t("workspace.surveys.edit.flow.value_placeholder");

  return (
    <InputCombobox
      id={id}
      // No free text on a true/false row, and clearing has no stored value to go back to.
      withInput={!isBoolean}
      clearable={!isBoolean}
      placeholder={isBoolean ? placeholder : undefined}
      aria-label={placeholder}
      value={getValueSelection(action, isBoolean)}
      inputProps={{
        placeholder,
        // A true/false row has no free-text box.
        type: fieldType === undefined || isBoolean ? "text" : fieldType,
      }}
      groupedOptions={getActionValueOptions(action.variableId, localSurvey, scopeBlockIdx, t)}
      onChangeValue={(val, option, fromInput) => {
        const optionType = option?.meta?.type as "static" | "variable" | "hiddenField" | "element";

        if (isBoolean) {
          const next = toBooleanSetValue(val, optionType);
          if (next) onChange({ operator: "assign", value: next } as Partial<TSurveyBlockLogicAction>);
          return;
        }
        if (!fromInput && optionType === "static") return;
        if (isDateOneStep) {
          // Stored as the expression's leaf (P38).
          const leaf: TExpression = { type: fromInput ? "static" : optionType, value: val as string };
          onChange({ operator: "assign", value: { type: "expression", value: leaf } });
        } else if (fromInput) {
          onChange({ value: { type: "static", value: val as string } });
        } else if (optionType !== "static") {
          onChange({ value: { type: optionType, value: val as string } });
        }
      }}
      comboboxClasses="grow shrink-0"
    />
  );
}
