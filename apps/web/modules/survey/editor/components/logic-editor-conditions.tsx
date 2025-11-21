"use client";

import { useTranslation } from "react-i18next";
import { TSurveyBlock, TSurveyBlockLogic } from "@formbricks/types/surveys/blocks";
import { TConditionGroup } from "@formbricks/types/surveys/logic";
import { TSurvey } from "@formbricks/types/surveys/types";
import { createSharedConditionsFactory } from "@/modules/survey/editor/lib/shared-conditions-factory";
import { getDefaultOperatorForElement } from "@/modules/survey/editor/lib/utils";
import { ConditionsEditor } from "@/modules/ui/components/conditions-editor";

interface LogicEditorConditionsProps {
  conditions: TConditionGroup;
  updateBlockLogic: (blockIdx: number, logic: TSurveyBlockLogic[]) => void;
  block: TSurveyBlock;
  localSurvey: TSurvey;
  blockIdx: number;
  logicIdx: number;
  depth?: number;
}

export function LogicEditorConditions({
  conditions,
  logicIdx,
  block,
  localSurvey,
  blockIdx,
  updateBlockLogic,
  depth = 0,
}: LogicEditorConditionsProps) {
  const { t } = useTranslation();

  const blockLogic = block.logic ?? [];
  const firstElement = block.elements[0];

  const { config, callbacks } = createSharedConditionsFactory(
    {
      survey: localSurvey,
      t,
      blockIdx,
      getDefaultOperator: () => (firstElement ? getDefaultOperatorForElement(firstElement, t) : "equals"),
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

        updateBlockLogic(blockIdx, logicCopy);
      },
    }
  );

  return <ConditionsEditor conditions={conditions} config={config} callbacks={callbacks} depth={depth} />;
}
