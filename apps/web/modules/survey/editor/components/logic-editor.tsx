"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { TSurveyBlockLogic } from "@formbricks/types/surveys/blocks";
import { TSurveyLogicConditionsOperator } from "@formbricks/types/surveys/logic";
import { TSurvey } from "@formbricks/types/surveys/types";
import { replaceHeadlineRecall } from "@/lib/utils/recall";
import { LogicEditorActions } from "@/modules/survey/editor/components/logic-editor-actions";
import { LogicEditorConditions } from "@/modules/survey/editor/components/logic-editor-conditions";
import { updateRuleActions, updateRuleConditions } from "@/modules/survey/editor/lib/rule-list";
import {
  getDefaultOperatorForElement,
  replaceEndingCardHeadlineRecall,
} from "@/modules/survey/editor/lib/utils";

interface LogicEditorProps {
  readonly localSurvey: TSurvey;
  /** The whole list the rule belongs to: a block's rules, or the rules before the first question. */
  readonly rules: TSurveyBlockLogic[];
  readonly ruleIdx: number;
  readonly onRulesChange: (rules: TSurveyBlockLogic[]) => void;
  /** The index of the block the rules run after; `-1` before the first question. */
  readonly scopeBlockIdx: number;
}

/**
 * Today's rule editor (If … then …) for one rule of any rule list (ENG-6929). It used to be wired to
 * one block's index and `updateBlockLogic`; the list and its owner now come from the caller, so the
 * Flow tab edits a block's rules and the rules before the first question (ENG-6932) with it.
 */
export function LogicEditor({ localSurvey, rules, ruleIdx, onRulesChange, scopeBlockIdx }: LogicEditorProps) {
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

  return (
    <div className="flex w-full min-w-full grow flex-col gap-4 overflow-x-auto pb-2 text-sm">
      <LogicEditorConditions
        conditions={rule.conditions}
        localSurvey={transformedSurvey}
        scopeBlockIdx={scopeBlockIdx}
        getDefaultOperator={getDefaultOperator}
        onConditionsChange={(updater) => onRulesChange(updateRuleConditions(rules, ruleIdx, updater))}
      />
      <LogicEditorActions
        localSurvey={transformedSurvey}
        actions={rule.actions}
        scopeBlockIdx={scopeBlockIdx}
        onActionsChange={(updater) => onRulesChange(updateRuleActions(rules, ruleIdx, updater))}
      />
    </div>
  );
}
