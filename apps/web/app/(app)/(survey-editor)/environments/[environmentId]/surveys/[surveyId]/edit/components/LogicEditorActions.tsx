import { LogicEditorAction } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/components/LogicEditorAction";
import { createId } from "@paralleldrive/cuid2";
import { CornerDownRightIcon } from "lucide-react";
import React, { useCallback, useMemo } from "react";
import { getUpdatedActionBody } from "@formbricks/lib/surveyLogic/utils";
import { TActionObjective, TSurvey, TSurveyLogic, TSurveyLogicAction } from "@formbricks/types/surveys/types";

interface LogicEditorActions {
  localSurvey: TSurvey;
  logicItem: TSurveyLogic;
  logicIdx: number;
  questionLogic: TSurveyLogic[];
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  questionIdx: number;
}

export const LogicEditorActions = ({
  localSurvey,
  logicItem,
  logicIdx,
  questionLogic,
  updateQuestion,
  questionIdx,
}: LogicEditorActions) => {
  const actions = logicItem.actions;

  const handleActionsChange = useCallback(
    (
      operation: "remove" | "addBelow" | "duplicate" | "update",
      actionIdx: number,
      action?: TSurveyLogicAction
    ) => {
      const currentLogicCopy = structuredClone(logicItem);
      const actionsClone = currentLogicCopy.actions;

      switch (operation) {
        case "remove":
          actionsClone.splice(actionIdx, 1);
          break;
        case "addBelow":
          actionsClone.splice(actionIdx + 1, 0, {
            id: createId(),
            objective: "jumpToQuestion",
            target: "",
          });
          break;
        case "duplicate":
          actionsClone.splice(actionIdx + 1, 0, { ...actionsClone[actionIdx], id: createId() });
          break;
        case "update":
          if (!action) return;
          actionsClone[actionIdx] = action;
          break;
      }

      const updatedLogic = questionLogic.map((item, idx) => (idx === logicIdx ? currentLogicCopy : item));

      updateQuestion(questionIdx, {
        logic: updatedLogic,
      });
    },
    [logicIdx, logicItem, questionIdx, questionLogic]
  );

  const handleObjectiveChange = useCallback(
    (actionIdx: number, objective: TActionObjective) => {
      const action = actions[actionIdx];
      const actionBody = getUpdatedActionBody(action, objective);
      handleActionsChange("update", actionIdx, actionBody);
    },
    [actions]
  );

  const handleValuesChange = useCallback(
    (actionIdx: number, values: Partial<TSurveyLogicAction>) => {
      const action = actions[actionIdx];
      const actionBody = { ...action, ...values } as TSurveyLogicAction;
      handleActionsChange("update", actionIdx, actionBody);
    },
    [actions]
  );

  const questions = useMemo(() => localSurvey.questions, [localSurvey.questions]);
  const endings = useMemo(() => localSurvey.endings, [localSurvey.endings]);
  const variables = useMemo(() => localSurvey.variables, [localSurvey.variables]);
  const hiddenFields = useMemo(() => localSurvey.hiddenFields, [localSurvey.hiddenFields]);

  return (
    <div className="flex grow gap-2">
      <CornerDownRightIcon className="mt-3 h-4 w-4 shrink-0" />
      <div className="flex grow flex-col gap-y-2">
        {actions?.map((action, idx) => (
          <LogicEditorAction
            action={action}
            actionIdx={idx}
            handleActionsChange={handleActionsChange}
            handleObjectiveChange={handleObjectiveChange}
            handleValuesChange={handleValuesChange}
            endings={endings}
            isRemoveDisabled={actions.length === 1}
            questions={questions}
            variables={variables}
            questionIdx={questionIdx}
            hiddenFields={hiddenFields}
          />
        ))}
      </div>
    </div>
  );
};
