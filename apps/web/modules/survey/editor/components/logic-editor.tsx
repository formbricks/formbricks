"use client";

import { createId } from "@paralleldrive/cuid2";
import { PlusIcon } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { TSurveyBlockLogic } from "@formbricks/types/surveys/blocks";
import { TSingleCondition, TSurveyLogicConditionsOperator } from "@formbricks/types/surveys/logic";
import { TSurvey } from "@formbricks/types/surveys/types";
import { replaceHeadlineRecall } from "@/lib/utils/recall";
import { LogicEditorActions } from "@/modules/survey/editor/components/logic-editor-actions";
import { LogicEditorConditions } from "@/modules/survey/editor/components/logic-editor-conditions";
import {
  START_SCOPE_BLOCK_IDX,
  getDefaultStartCondition,
  updateRuleActions,
  updateRuleConditions,
} from "@/modules/survey/editor/lib/rule-list";
import {
  getDefaultOperatorForElement,
  replaceEndingCardHeadlineRecall,
} from "@/modules/survey/editor/lib/utils";
import { Button } from "@/modules/ui/components/button";

interface LogicEditorProps {
  readonly localSurvey: TSurvey;
  /** The whole list the rule belongs to: a block's rules, or the rules before the first question. */
  readonly rules: TSurveyBlockLogic[];
  readonly ruleIdx: number;
  readonly onRulesChange: (rules: TSurveyBlockLogic[]) => void;
  /** The index of the block the rules run after; `-1` before the first question. */
  readonly scopeBlockIdx: number;
  /** Opens the Embedded Data card to add a Calculated field, from Set value's empty field picker. */
  readonly onAddCalculatedField?: () => void;
}

/**
 * Today's rule editor (If … then …) for one rule of any rule list (ENG-6929). It used to be wired to
 * one block's index and `updateBlockLogic`; the list and its owner now come from the caller, so the
 * Flow tab edits a block's rules and the rules before the first question (ENG-6932) with it.
 */
export function LogicEditor({
  localSurvey,
  rules,
  ruleIdx,
  onRulesChange,
  scopeBlockIdx,
  onAddCalculatedField,
}: LogicEditorProps) {
  const { t } = useTranslation();
  const rule = rules[ruleIdx];

  // Option labels in the pickers read recalled headlines as plain text.
  const transformedSurvey = useMemo(
    () => replaceEndingCardHeadlineRecall(replaceHeadlineRecall(localSurvey, "default"), "default"),
    [localSurvey]
  );

  const firstElement = localSurvey.blocks[scopeBlockIdx]?.elements[0];
  const getDefaultOperator = (): TSurveyLogicConditionsOperator =>
    firstElement ? getDefaultOperatorForElement(firstElement, t) : "equals";

  if (!rule) return null;

  // ENG-6935: a Set value step always runs — an empty `and` group (ADR 0026). It reads as such, and
  // gets a condition only when asked, which makes it a calculation. Only a rule that sets values or
  // marks Low quality stays without a condition (rule-list.ts); before the first question there is no
  // answer, so its first condition reads a URL parameter.
  const alwaysRuns = rule.conditions.conditions.length === 0;
  const getFirstCondition = (): Omit<TSingleCondition, "id"> | undefined => {
    if (scopeBlockIdx === START_SCOPE_BLOCK_IDX) return getDefaultStartCondition(localSurvey);
    if (!firstElement) return undefined;
    return { leftOperand: { type: "element", value: firstElement.id }, operator: getDefaultOperator() };
  };
  const canAddCondition = scopeBlockIdx === START_SCOPE_BLOCK_IDX || !!firstElement;
  const addFirstCondition = () => {
    const firstCondition = getFirstCondition();
    if (!firstCondition) return;
    onRulesChange(
      updateRuleConditions(rules, ruleIdx, (group) => ({
        ...group,
        conditions: [{ id: createId(), ...firstCondition }],
      }))
    );
  };

  return (
    <div className="flex w-full min-w-full grow flex-col gap-3 text-sm">
      {alwaysRuns ? (
        <div className="flex min-h-10 items-center gap-3">
          <span className="font-medium text-slate-900">{t("workspace.surveys.edit.flow.always_runs")}</span>
          {canAddCondition && (
            <Button type="button" size="sm" variant="secondary" onClick={addFirstCondition}>
              <PlusIcon />
              {t("workspace.surveys.edit.flow.add_condition")}
            </Button>
          )}
        </div>
      ) : (
        <LogicEditorConditions
          conditions={rule.conditions}
          localSurvey={transformedSurvey}
          scopeBlockIdx={scopeBlockIdx}
          getDefaultOperator={getDefaultOperator}
          onConditionsChange={(updater) => onRulesChange(updateRuleConditions(rules, ruleIdx, updater))}
        />
      )}
      <LogicEditorActions
        localSurvey={transformedSurvey}
        actions={rule.actions}
        scopeBlockIdx={scopeBlockIdx}
        alwaysRuns={alwaysRuns}
        onAddCalculatedField={onAddCalculatedField}
        onActionsChange={(updater) => onRulesChange(updateRuleActions(rules, ruleIdx, updater))}
      />
    </div>
  );
}
