"use client";

import { useTranslation } from "react-i18next";
import { TSurveyBlockLogic } from "@formbricks/types/surveys/blocks";
import { TSurveyElement } from "@formbricks/types/surveys/elements";
import { TConditionGroup } from "@formbricks/types/surveys/logic";
import { TSurvey, TSurveyQuestion } from "@formbricks/types/surveys/types";
import { createSharedConditionsFactory } from "@/modules/survey/editor/lib/shared-conditions-factory";
import { getDefaultOperatorForQuestion } from "@/modules/survey/editor/lib/utils";
import { ConditionsEditor } from "@/modules/ui/components/conditions-editor";

interface LogicEditorConditionsProps {
  conditions: TConditionGroup;
  updateQuestion: (questionIdx: number, updatedAttributes: Partial<TSurveyQuestion>) => void;
  updateBlockLogic: (questionIdx: number, logic: TSurveyBlockLogic[]) => void;
  question: TSurveyElement;
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
  updateBlockLogic,
  depth = 0,
}: LogicEditorConditionsProps) {
  const { t } = useTranslation();

  // Find the parent block for this question/element to get its logic
  const parentBlock = localSurvey.blocks?.find((block) =>
    block.elements.some((element) => element.id === question.id)
  );
  const blockLogic = parentBlock?.logic ?? [];

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
        const logicCopy = structuredClone(blockLogic);
        const logicItem = logicCopy[logicIdx];
        if (!logicItem) return;
        logicItem.conditions = updater(logicItem.conditions);

        if (logicItem.conditions.conditions.length === 0) {
          logicCopy.splice(logicIdx, 1);
        }

        updateBlockLogic(questionIdx, logicCopy);
      },
    }
  );

  return <ConditionsEditor conditions={conditions} config={config} callbacks={callbacks} depth={depth} />;
}
