"use client";

import { createSharedConditionsFactory } from "@/modules/survey/editor/lib/shared-conditions-factory";
import { getDefaultOperatorForQuestion } from "@/modules/survey/editor/lib/utils";
import { ConditionsEditor } from "@/modules/ui/components/conditions-editor";
import { useTranslate } from "@tolgee/react";
import { TConditionGroup, TSurvey, TSurveyQuestion } from "@formbricks/types/surveys/types";

interface LogicEditorConditionsProps {
  conditions: TConditionGroup;
  updateQuestion: (questionIdx: number, updatedAttributes: Partial<TSurveyQuestion>) => void;
  question: TSurveyQuestion;
  localSurvey: TSurvey;
  questionIdx: number;
  logicIdx: number;
  depth?: number;
}

export function LogicEditorConditions({
  conditions,
  logicIdx,
  question,
  localSurvey,
  questionIdx,
  updateQuestion,
  depth = 0,
}: LogicEditorConditionsProps) {
  const { t } = useTranslate();

  const { config, callbacks } = createSharedConditionsFactory(
    {
      survey: localSurvey,
      t,
      questionIdx,
      getDefaultOperator: () => getDefaultOperatorForQuestion(question, t),
      includeCreateGroup: true,
    },
    {
      onConditionsChange: (updater) => {
        const logicCopy = structuredClone(question.logic) ?? [];
        const logicItem = logicCopy[logicIdx];
        if (!logicItem) return;
        logicItem.conditions = updater(logicItem.conditions);

        if (logicItem.conditions.conditions.length === 0) {
          logicCopy.splice(logicIdx, 1);
        }

        updateQuestion(questionIdx, { logic: logicCopy });
      },
    }
  );

  return <ConditionsEditor conditions={conditions} config={config} callbacks={callbacks} depth={depth} />;
}
