import {
  getConditionOperatorOptions,
  getConditionValueOptions,
  getMatchValueProps,
} from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/lib/util";
import { createId } from "@paralleldrive/cuid2";
import { CopyIcon, MoreVerticalIcon, PlusIcon, TrashIcon, WorkflowIcon } from "lucide-react";
import { cn } from "@formbricks/lib/cn";
import {
  addConditionBelow,
  createGroupFromResource,
  duplicateCondition,
  isConditionsGroup,
  removeCondition,
  toggleGroupConnector,
  updateCondition,
} from "@formbricks/lib/survey/logic/utils";
import {
  TConditionGroup,
  TDyanmicLogicField,
  TRightOperand,
  TSingleCondition,
  TSurveyLogicCondition,
} from "@formbricks/types/surveys/logic";
import { TSurvey, TSurveyQuestion } from "@formbricks/types/surveys/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@formbricks/ui/DropdownMenu";
import { InputCombobox, TComboboxOption } from "@formbricks/ui/InputCombobox";

interface AdvancedLogicEditorConditions {
  conditions: TConditionGroup;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  question: TSurveyQuestion;
  localSurvey: TSurvey;
  questionIdx: number;
  logicIdx: number;
  depth?: number;
}

export function AdvancedLogicEditorConditions({
  conditions,
  logicIdx,
  question,
  localSurvey,
  questionIdx,
  updateQuestion,
  depth = 0,
}: AdvancedLogicEditorConditions) {
  const handleAddConditionBelow = (resourceId: string, condition: TSingleCondition) => {
    const logicCopy = structuredClone(question.logic) || [];
    const logicItem = logicCopy[logicIdx];
    addConditionBelow(logicItem.conditions, resourceId, condition);

    updateQuestion(questionIdx, {
      logic: logicCopy,
    });
  };

  const handleConnectorChange = (groupId: string) => {
    const logicCopy = structuredClone(question.logic) || [];
    const logicItem = logicCopy[logicIdx];
    toggleGroupConnector(logicItem.conditions, groupId);

    updateQuestion(questionIdx, {
      logic: logicCopy,
    });
  };

  const handleRemoveCondition = (resourceId: string) => {
    const logicCopy = structuredClone(question.logic) || [];
    const logicItem = logicCopy[logicIdx];
    removeCondition(logicItem.conditions, resourceId);

    // Remove the logic item if there are no conditions left
    if (logicItem.conditions.conditions.length === 0) {
      logicCopy.splice(logicIdx, 1);
    }

    updateQuestion(questionIdx, {
      logic: logicCopy,
    });
  };

  const handleDuplicateCondition = (resourceId: string) => {
    const logicCopy = structuredClone(question.logic) || [];
    const logicItem = logicCopy[logicIdx];
    duplicateCondition(logicItem.conditions, resourceId);

    updateQuestion(questionIdx, {
      logic: logicCopy,
    });
  };

  const handleCreateGroup = (resourceId: string) => {
    const logicCopy = structuredClone(question.logic) || [];
    const logicItem = logicCopy[logicIdx];
    createGroupFromResource(logicItem.conditions, resourceId);

    updateQuestion(questionIdx, {
      logic: logicCopy,
    });
  };

  const handleUpdateCondition = (resourceId: string, updateConditionBody: Partial<TSingleCondition>) => {
    const logicCopy = structuredClone(question.logic) || [];
    const logicItem = logicCopy[logicIdx];
    updateCondition(logicItem.conditions, resourceId, updateConditionBody);

    updateQuestion(questionIdx, {
      logic: logicCopy,
    });
  };

  const handleQuestionChange = (condition: TSingleCondition, value: string, option?: TComboboxOption) => {
    handleUpdateCondition(condition.id, {
      leftOperand: {
        value,
        type: option?.meta?.type as TDyanmicLogicField,
      },
      operator: "isSkipped",
      rightOperand: undefined,
    });
  };

  const handleOperatorChange = (condition: TSingleCondition, value: TSurveyLogicCondition) => {
    handleUpdateCondition(condition.id, {
      operator: value,
      rightOperand: undefined,
    });
  };

  const handleRightOperandChange = (
    condition: TSingleCondition,
    value: string | number | string[],
    option?: TComboboxOption
  ) => {
    const type = (option?.meta?.type as TRightOperand["type"]) || "static";

    switch (type) {
      case "question":
      case "hiddenField":
      case "variable":
        handleUpdateCondition(condition.id, {
          rightOperand: {
            value: value as string,
            type,
          },
        });
        break;
      case "static":
        handleUpdateCondition(condition.id, {
          rightOperand: {
            value,
            type,
          },
        });
        break;
    }
  };
  const renderCondition = (
    condition: TSingleCondition | TConditionGroup,
    index: number,
    parentConditionGroup: TConditionGroup
  ) => {
    const connector = parentConditionGroup.connector;
    if (isConditionsGroup(condition)) {
      return (
        <div key={condition.id} className="flex items-start justify-between gap-4">
          {index === 0 ? (
            <div>When</div>
          ) : (
            <div
              className={cn("w-14", { "cursor-pointer underline": index === 1 })}
              onClick={() => {
                if (index !== 1) return;
                handleConnectorChange(parentConditionGroup.id);
              }}>
              {connector}
            </div>
          )}
          <div className="rounded-lg border border-slate-400 p-3">
            <AdvancedLogicEditorConditions
              conditions={condition}
              updateQuestion={updateQuestion}
              localSurvey={localSurvey}
              question={question}
              questionIdx={questionIdx}
              logicIdx={logicIdx}
              depth={depth + 1}
            />
          </div>
          <div className="mt-2">
            <DropdownMenu>
              <DropdownMenuTrigger>
                <MoreVerticalIcon className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  className="flex items-center gap-2"
                  onClick={() => {
                    handleAddConditionBelow(condition.id, {
                      id: createId(),
                      leftOperand: {
                        value: localSurvey.questions[questionIdx].id,
                        type: "question",
                      },
                      operator: "equals",
                    });
                  }}>
                  <PlusIcon className="h-4 w-4" />
                  Add condition below
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="flex items-center gap-2"
                  disabled={depth === 0 && conditions.conditions.length === 1}
                  onClick={() => handleRemoveCondition(condition.id)}>
                  <TrashIcon className="h-4 w-4" />
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      );
    }

    const conditionValueOptions = getConditionValueOptions(localSurvey, questionIdx);
    const conditionOperatorOptions = getConditionOperatorOptions(condition, localSurvey);
    const { show, options, showInput = false, inputType } = getMatchValueProps(condition, localSurvey);

    return (
      <div key={condition.id} className="flex items-center gap-x-2">
        <div className="w-10 shrink-0">
          {index === 0 ? (
            "When"
          ) : (
            <div
              className={cn("w-14", { "cursor-pointer underline": index === 1 })}
              onClick={() => {
                if (index !== 1) return;
                handleConnectorChange(parentConditionGroup.id);
              }}>
              {connector}
            </div>
          )}
        </div>
        <InputCombobox
          key="conditionValue"
          showSearch={false}
          groupedOptions={conditionValueOptions}
          value={condition.leftOperand.value}
          onChangeValue={(val: string, option) => {
            handleQuestionChange(condition, val, option);
          }}
          comboboxClasses="grow"
        />
        <InputCombobox
          key="conditionOperator"
          showSearch={false}
          options={conditionOperatorOptions}
          value={condition.operator}
          onChangeValue={(val: TSurveyLogicCondition) => {
            handleOperatorChange(condition, val);
          }}
          comboboxClasses="grow min-w-[150px]"
        />
        {show && (
          <InputCombobox
            withInput={showInput}
            inputProps={{
              type: inputType,
              placeholder: "Value",
            }}
            key="conditionMatchValue"
            showSearch={false}
            groupedOptions={options}
            allowMultiSelect={["equalsOneOf", "includesAllOf", "includesOneOf"].includes(condition.operator)}
            comboboxClasses="grow min-w-[100px] max-w-[300px]"
            value={condition.rightOperand?.value}
            clearable={true}
            onChangeValue={(val, option) => {
              handleRightOperandChange(condition, val, option);
            }}
          />
        )}
        <DropdownMenu>
          <DropdownMenuTrigger>
            <MoreVerticalIcon className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              className="flex items-center gap-2"
              onClick={() => {
                handleAddConditionBelow(condition.id, {
                  id: createId(),
                  leftOperand: {
                    value: localSurvey.questions[questionIdx].id,
                    type: "question",
                  },
                  operator: "equals",
                });
              }}>
              <PlusIcon className="h-4 w-4" />
              Add condition below
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex items-center gap-2"
              disabled={depth === 0 && conditions.conditions.length === 1}
              onClick={() => handleRemoveCondition(condition.id)}>
              <TrashIcon className="h-4 w-4" />
              Remove
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex items-center gap-2"
              onClick={() => handleDuplicateCondition(condition.id)}>
              <CopyIcon className="h-4 w-4" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex items-center gap-2"
              onClick={() => handleCreateGroup(condition.id)}>
              <WorkflowIcon className="h-4 w-4" />
              Create group
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-y-2">
      {conditions?.conditions.map((condition, index) => renderCondition(condition, index, conditions))}
    </div>
  );
}
