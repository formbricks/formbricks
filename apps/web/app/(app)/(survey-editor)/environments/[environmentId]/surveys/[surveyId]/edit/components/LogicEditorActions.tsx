import { LogicEditorAction } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/components/LogicEditorAction";
import {
  actionObjectiveOptions,
  getActionOperatorOptions, // getActionTargetOptions,
  getActionValueOptions,
  getActionVariableOptions,
} from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/lib/utils";
import { createId } from "@paralleldrive/cuid2";
import { CopyIcon, CornerDownRightIcon, EllipsisVerticalIcon, PlusIcon, TrashIcon } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { getUpdatedActionBody } from "@formbricks/lib/surveyLogic/utils";
import { questionIconMapping } from "@formbricks/lib/utils/questions";
import {
  TActionNumberVariableCalculateOperator,
  TActionObjective,
  TActionTextVariableCalculateOperator,
  TActionVariableValueType,
  TSurvey,
  TSurveyLogic,
  TSurveyLogicAction,
  TSurveyQuestion,
} from "@formbricks/types/surveys/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@formbricks/ui/DropdownMenu";
import { InputCombobox, TComboboxOption } from "@formbricks/ui/InputCombobox";

interface LogicEditorActions {
  localSurvey: TSurvey;
  logicItem: TSurveyLogic;
  logicIdx: number;
  question: TSurveyQuestion;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  questionIdx: number;
}

export const LogicEditorActions = ({
  localSurvey,
  logicItem,
  logicIdx,
  question,
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
      const logicCopy = structuredClone(question.logic) ?? [];
      const currentLogicItem = logicCopy[logicIdx];
      const actionsClone = currentLogicItem.actions;

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

      updateQuestion(questionIdx, {
        logic: logicCopy,
      });
    },
    [logicIdx, question.logic, questionIdx]
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

  const filteredQuestions = useMemo(
    () => localSurvey.questions.filter((_, idx) => idx !== questionIdx),
    [localSurvey.questions, questionIdx]
  );

  const endings = useMemo(() => localSurvey.endings, [JSON.stringify(localSurvey.endings)]);

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
            filteredQuestions={filteredQuestions}
          />
        ))}
      </div>
    </div>
  );
};

// a code snippet living in a component
// source: https://stackoverflow.com/a/59843241/3600510
const usePrevious = (value, initialValue) => {
  const ref = useRef(initialValue);
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
};
const useEffectDebugger = (effectHook, dependencies, dependencyNames = []) => {
  const previousDeps = usePrevious(dependencies, []);

  const changedDeps = dependencies.reduce((accum, dependency, index) => {
    if (dependency !== previousDeps[index]) {
      const keyName = dependencyNames[index] || index;
      return {
        ...accum,
        [keyName]: {
          before: previousDeps[index],
          after: dependency,
        },
      };
    }

    return accum;
  }, {});

  if (Object.keys(changedDeps).length) {
    console.log("[use-effect-debugger] ", changedDeps);
  }

  useEffect(effectHook, dependencies);
};
