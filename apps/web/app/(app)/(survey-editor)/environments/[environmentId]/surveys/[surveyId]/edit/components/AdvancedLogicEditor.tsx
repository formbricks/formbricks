import { AdvancedLogicEditorActions } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/components/AdvancedLogicEditorActions";
import { AdvancedLogicEditorConditions } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/components/AdvancedLogicEditorConditions";
import { createId } from "@paralleldrive/cuid2";
import { removeAction } from "@formbricks/lib/survey/logic/utils";
import { TAction, TSurveyAdvancedLogic } from "@formbricks/types/surveys/logic";
import { TSurvey, TSurveyQuestion } from "@formbricks/types/surveys/types";

interface AdvancedLogicEditorProps {
  localSurvey: TSurvey;
  logicItem: TSurveyAdvancedLogic;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  question: TSurveyQuestion;
  questionIdx: number;
  logicIdx: number;
  userAttributes: string[];
}

export function AdvancedLogicEditor({
  localSurvey,
  logicItem,
  updateQuestion,
  question,
  questionIdx,
  logicIdx,
  userAttributes,
}: AdvancedLogicEditorProps) {
  const handleActionsChange = (
    operation: "delete" | "addBelow" | "duplicate" | "update",
    actionIdx: number,
    action?: Partial<TAction>
  ) => {
    const actionsClone = structuredClone(logicItem.actions);
    let updatedActions: TSurveyAdvancedLogic["actions"] = actionsClone;

    if (operation === "delete") {
      updatedActions = removeAction(actionsClone, actionIdx);
    } else if (operation === "addBelow") {
      updatedActions.splice(actionIdx + 1, 0, { id: createId(), objective: "jumpToQuestion", target: "" });
    } else if (operation === "duplicate") {
      updatedActions.splice(actionIdx + 1, 0, actionsClone[actionIdx]);
    } else if (operation === "update") {
      updatedActions[actionIdx] = {
        ...updatedActions[actionIdx],
        ...action,
      };
    }

    updateQuestion(questionIdx, {
      advancedLogic: question.advancedLogic?.map((logicItem, i) => {
        if (i === logicIdx) {
          return {
            ...logicItem,
            actions: updatedActions,
          };
        }

        return logicItem;
      }),
    });
  };
  return (
    <div className="flex w-full flex-col gap-4 overflow-auto rounded-lg border border-slate-200 bg-slate-100 p-4">
      <AdvancedLogicEditorConditions
        conditions={logicItem.conditions}
        updateQuestion={updateQuestion}
        question={question}
        questionIdx={questionIdx}
        localSurvey={localSurvey}
        logicIdx={logicIdx}
        userAttributes={userAttributes}
      />
      <AdvancedLogicEditorActions
        logicItem={logicItem}
        handleActionsChange={handleActionsChange}
        localSurvey={localSurvey}
        userAttributes={userAttributes}
        questionIdx={questionIdx}
      />
    </div>
  );
}
