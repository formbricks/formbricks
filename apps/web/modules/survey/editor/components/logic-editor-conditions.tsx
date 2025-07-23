"use client";

import {
  addConditionBelow,
  createGroupFromResource,
  duplicateCondition,
  removeCondition,
  toggleGroupConnector,
  updateCondition,
} from "@/lib/surveyLogic/utils";
import {
  getConditionOperatorOptions,
  getConditionValueOptions,
  getDefaultOperatorForQuestion,
  getMatchValueProps,
} from "@/modules/survey/editor/lib/utils";
import { ConditionsEditor } from "@/modules/ui/components/conditions-editor";
import {
  TConditionsEditorCallbacks,
  TConditionsEditorConfig,
} from "@/modules/ui/components/conditions-editor/types";
import { createId } from "@paralleldrive/cuid2";
import { useTranslate } from "@tolgee/react";
import {
  TConditionGroup,
  TDynamicLogicField,
  TSingleCondition,
  TSurvey,
  TSurveyQuestion,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";

interface LogicEditorConditionsProps {
  conditions: TConditionGroup;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
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

  const config: TConditionsEditorConfig<TSingleCondition> = {
    getLeftOperandOptions: () => getConditionValueOptions(localSurvey, questionIdx, t),
    getOperatorOptions: (condition) => getConditionOperatorOptions(condition, localSurvey, t),
    getValueProps: (condition) => getMatchValueProps(condition, localSurvey, questionIdx, t),
    getDefaultOperator: () => getDefaultOperatorForQuestion(question, t),
    formatLeftOperandValue: (condition) => {
      if (condition.leftOperand.type === "question") {
        const questionEntity = localSurvey.questions.find((q) => q.id === condition.leftOperand.value);
        if (questionEntity && questionEntity.type === TSurveyQuestionTypeEnum.Matrix) {
          if (condition.leftOperand?.meta?.row !== undefined) {
            return `${condition.leftOperand.value}.${condition.leftOperand.meta.row}`;
          }
        }
      }
      return condition.leftOperand.value;
    },
  };

  const callbacks: TConditionsEditorCallbacks<TSingleCondition> = {
    onAddConditionBelow: (resourceId) => {
      const operator = getDefaultOperatorForQuestion(question, t);

      const condition: TSingleCondition = {
        id: createId(),
        leftOperand: {
          value: question.id,
          type: "question",
        },
        operator,
      };

      const logicCopy = structuredClone(question.logic) ?? [];
      const logicItem = logicCopy[logicIdx];
      addConditionBelow(logicItem.conditions, resourceId, condition);

      updateQuestion(questionIdx, {
        logic: logicCopy,
      });
    },

    onRemoveCondition: (resourceId) => {
      const logicCopy = structuredClone(question.logic) ?? [];
      const logicItem = logicCopy[logicIdx];
      removeCondition(logicItem.conditions, resourceId);

      // Remove the logic item if there are zero conditions left
      if (logicItem.conditions.conditions.length === 0) {
        logicCopy.splice(logicIdx, 1);
      }

      updateQuestion(questionIdx, {
        logic: logicCopy,
      });
    },

    onDuplicateCondition: (resourceId) => {
      const logicCopy = structuredClone(question.logic) ?? [];
      const logicItem = logicCopy[logicIdx];
      duplicateCondition(logicItem.conditions, resourceId);

      updateQuestion(questionIdx, {
        logic: logicCopy,
      });
    },

    onCreateGroup: (resourceId) => {
      const logicCopy = structuredClone(question.logic) ?? [];
      const logicItem = logicCopy[logicIdx];
      createGroupFromResource(logicItem.conditions, resourceId);

      updateQuestion(questionIdx, {
        logic: logicCopy,
      });
    },

    onUpdateCondition: (resourceId, updates) => {
      const logicCopy = structuredClone(question.logic) ?? [];
      const logicItem = logicCopy[logicIdx];

      // Handle special case for matrix questions
      if (updates.leftOperand && updates.leftOperand.type === "question") {
        const type = updates.leftOperand.meta?.type as TDynamicLogicField;
        if (type === "question") {
          const [questionId, rowId] = updates.leftOperand.value.split(".");
          const questionEntity = localSurvey.questions.find((q) => q.id === questionId);

          if (questionEntity && questionEntity.type === TSurveyQuestionTypeEnum.Matrix) {
            if (updates.leftOperand.value.includes(".")) {
              // Matrix question with rowId is selected
              updateCondition(logicItem.conditions, resourceId, {
                leftOperand: {
                  value: questionId,
                  type: "question",
                  meta: {
                    row: rowId,
                  },
                },
                operator: "isEmpty",
                rightOperand: undefined,
              });
              updateQuestion(questionIdx, { logic: logicCopy });
              return;
            }
          }
        }
      }

      updateCondition(logicItem.conditions, resourceId, updates);

      updateQuestion(questionIdx, {
        logic: logicCopy,
      });
    },

    onToggleGroupConnector: (groupId: string) => {
      const logicCopy = structuredClone(question.logic) ?? [];
      const logicItem = logicCopy[logicIdx];
      toggleGroupConnector(logicItem.conditions, groupId);

      updateQuestion(questionIdx, {
        logic: logicCopy,
      });
    },
  };

  return <ConditionsEditor conditions={conditions} config={config} callbacks={callbacks} depth={depth} />;
}
