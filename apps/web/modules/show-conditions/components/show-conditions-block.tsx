"use client";

import { PlusIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type {
  TShowConditionGroup,
  TShowConditionSingle,
  TShowConditions,
} from "@formbricks/types/show-conditions";
import { cn } from "@/lib/cn";
import { ShowConditionValueInput } from "@/modules/show-conditions/components/show-condition-value-input";
import { ShowConditionsUrlTester } from "@/modules/show-conditions/components/show-conditions-url-tester";
import {
  getShowConditionOperandOptions,
  getShowConditionOperatorOptions,
  getShowConditionValueOptions,
} from "@/modules/show-conditions/lib/options";
import {
  type TShowConditionUpdate,
  addShowConditionBelow,
  appendShowCondition,
  canCreateShowConditionGroup,
  createShowConditionGroup,
  duplicateShowCondition,
  removeShowCondition,
  toggleShowConditionConnector,
  updateShowCondition,
} from "@/modules/show-conditions/lib/tree";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { ConditionsEditor } from "@/modules/ui/components/conditions-editor";
import type {
  TConditionsEditorCallbacks,
  TConditionsEditorConfig,
  TGenericCondition,
} from "@/modules/ui/components/conditions-editor/types";

interface ShowConditionsBlockProps {
  value: TShowConditions;
  onChange: (value: TShowConditions) => void;
  isReadOnly?: boolean;
}

const ENUM_OPERANDS = new Set(["deviceType", "browser"]);
const PRESENCE_OPERATORS = new Set(["isSet", "isNotSet"]);

/**
 * "…and only show it": the show conditions of whatever it is given (ENG-3575). Knows nothing about
 * surveys — the survey editor renders it inside the Survey Trigger card, and Creatives render the same
 * block for theirs. Built on the shared `ConditionsEditor`, so it reads like survey logic: "when all
 * are true", rows joined by "and" / "or", one level of groups.
 */
export const ShowConditionsBlock = ({
  value,
  onChange,
  isReadOnly = false,
}: Readonly<ShowConditionsBlockProps>) => {
  const { t } = useTranslation();

  const edit = (change: (root: TShowConditionGroup) => TShowConditions) => {
    if (isReadOnly || !value) return;
    onChange(change(value));
  };
  const updateCondition = (id: string, update: TShowConditionUpdate) =>
    edit((root) => updateShowCondition(root, id, update));

  const config: TConditionsEditorConfig = {
    getLeftOperandOptions: () => getShowConditionOperandOptions(t),
    getOperatorOptions: (condition) =>
      getShowConditionOperatorOptions((condition as TShowConditionSingle).leftOperand.value, t),
    getValueProps: (condition) => {
      const options = getShowConditionValueOptions((condition as TShowConditionSingle).leftOperand.value, t);
      return options ? { show: true, options } : { show: false, options: [] };
    },
    // The editor resets the operator when the operand changes; `updateShowCondition` then picks the
    // real default for the new operand, so this only has to be a placeholder.
    getDefaultOperator: () => "equals",
    formatLeftOperandValue: (condition) => condition.leftOperand.value,
    renderValueInput: (condition: TGenericCondition) => {
      const single = condition as TShowConditionSingle;
      if (ENUM_OPERANDS.has(single.leftOperand.value)) return undefined;
      if (PRESENCE_OPERATORS.has(single.operator) && single.leftOperand.value !== "queryParam") return null;
      return (
        <ShowConditionValueInput
          key={`${single.id}-${single.leftOperand.value}-${single.operator}`}
          condition={single}
          isReadOnly={isReadOnly}
          onUpdate={(update) => updateCondition(single.id, update)}
        />
      );
    },
    canCreateGroup: canCreateShowConditionGroup,
  };

  const callbacks: TConditionsEditorCallbacks = {
    onAddConditionBelow: (id) => edit((root) => addShowConditionBelow(root, id)),
    onRemoveCondition: (id) => edit((root) => removeShowCondition(root, id)),
    onDuplicateCondition: (id) => edit((root) => duplicateShowCondition(root, id)),
    onCreateGroup: (id) => edit((root) => createShowConditionGroup(root, id)),
    onUpdateCondition: (id, update) => updateCondition(id, update as TShowConditionUpdate),
    onToggleGroupConnector: (groupId) => edit((root) => toggleShowConditionConnector(root, groupId)),
  };

  return (
    <div className="flex flex-col gap-4 border-t border-slate-200 pt-4">
      <div>
        <p className="text-sm font-semibold text-slate-800">
          {t("workspace.surveys.edit.show_conditions.heading")}
        </p>
        <p className="text-sm text-slate-500">{t("workspace.surveys.edit.show_conditions.description")}</p>
      </div>

      {value && (
        <fieldset
          aria-label={t("workspace.surveys.edit.show_conditions.heading")}
          aria-disabled={isReadOnly || undefined}
          disabled={isReadOnly}
          className={cn("min-w-0", isReadOnly && "pointer-events-none")}>
          <ConditionsEditor conditions={value} config={config} callbacks={callbacks} />
        </fieldset>
      )}

      {!isReadOnly && (
        <div>
          <Button variant="secondary" size="sm" onClick={() => onChange(appendShowCondition(value))}>
            <PlusIcon className="mr-2 size-4" />
            {t("workspace.surveys.edit.show_conditions.add_condition")}
          </Button>
        </div>
      )}

      <ShowConditionsUrlTester conditions={value} />

      <Alert variant="info" size="small">
        <AlertDescription>{t("workspace.surveys.edit.show_conditions.mobile_note")}</AlertDescription>
      </Alert>
    </div>
  );
};
