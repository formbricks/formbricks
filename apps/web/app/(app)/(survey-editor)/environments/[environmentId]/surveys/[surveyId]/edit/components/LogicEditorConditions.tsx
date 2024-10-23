import {
  getConditionOperatorOptions,
  getConditionValueOptions,
  getDefaultOperatorForQuestion,
  getMatchValueProps,
} from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/lib/utils";
import { createId } from "@paralleldrive/cuid2";
import { CopyIcon, EllipsisVerticalIcon, PlusIcon, TrashIcon, WorkflowIcon } from "lucide-react";
import { cn } from "@formbricks/lib/cn";
import {
  addConditionBelow,
  createGroupFromResource,
  duplicateCondition,
  isConditionGroup,
  removeCondition,
  toggleGroupConnector,
  updateCondition,
} from "@formbricks/lib/surveyLogic/utils";
import {
  TConditionGroup,
  TDynamicLogicField,
  TRightOperand,
  TSingleCondition,
  TSurvey,
  TSurveyLogicConditionsOperator,
  TSurveyQuestion,
} from "@formbricks/types/surveys/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@formbricks/ui/components/DropdownMenu";
import { InputCombobox, TComboboxOption } from "@formbricks/ui/components/InputCombobox";

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
  const handleAddConditionBelow = (resourceId: string) => {
    const operator = getDefaultOperatorForQuestion(question);

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
  };

  const handleConnectorChange = (groupId: string) => {
    const logicCopy = structuredClone(question.logic) ?? [];
    const logicItem = logicCopy[logicIdx];
    toggleGroupConnector(logicItem.conditions, groupId);

    updateQuestion(questionIdx, {
      logic: logicCopy,
    });
  };

  const handleRemoveCondition = (resourceId: string) => {
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
  };

  const handleDuplicateCondition = (resourceId: string) => {
    const logicCopy = structuredClone(question.logic) ?? [];
    const logicItem = logicCopy[logicIdx];
    duplicateCondition(logicItem.conditions, resourceId);

    updateQuestion(questionIdx, {
      logic: logicCopy,
    });
  };

  const handleCreateGroup = (resourceId: string) => {
    const logicCopy = structuredClone(question.logic) ?? [];
    const logicItem = logicCopy[logicIdx];
    createGroupFromResource(logicItem.conditions, resourceId);

    updateQuestion(questionIdx, {
      logic: logicCopy,
    });
  };

  const handleUpdateCondition = (resourceId: string, updateConditionBody: Partial<TSingleCondition>) => {
    const logicCopy = structuredClone(question.logic) ?? [];
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
        type: option?.meta?.type as TDynamicLogicField,
      },
      operator: "isSkipped",
      rightOperand: undefined,
    });
  };

  const handleOperatorChange = (condition: TSingleCondition, value: TSurveyLogicConditionsOperator) => {
    if (value !== condition.operator) {
      handleUpdateCondition(condition.id, {
        operator: value,
        rightOperand: undefined,
      });
    }
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
    if (isConditionGroup(condition)) {
      return (
        <div key={condition.id} className="flex items-start justify-between gap-4">
          {index === 0 ? (
            <div>When</div>
          ) : (
            <div
              className={cn("w-14", index === 1 && "cursor-pointer underline")}
              onClick={() => {
                if (index !== 1) return;
                handleConnectorChange(parentConditionGroup.id);
              }}>
              {connector}
            </div>
          )}
          <div className="rounded-lg border border-slate-400 p-3">
            <LogicEditorConditions
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
                <EllipsisVerticalIcon className="h-4 w-4 text-slate-700 hover:text-slate-950" />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onClick={() => {
                    handleAddConditionBelow(condition.id);
                  }}
                  icon={<PlusIcon className="h-4 w-4" />}>
                  Add condition below
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={depth === 0 && conditions.conditions.length === 1}
                  onClick={() => handleRemoveCondition(condition.id)}
                  icon={<TrashIcon className="h-4 w-4" />}>
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

    const allowMultiSelect = ["equalsOneOf", "includesAllOf", "includesOneOf"].includes(condition.operator);
    return (
      <div key={condition.id} className="flex items-center gap-x-2">
        <div className="w-10 shrink-0">
          {index === 0 ? (
            "When"
          ) : (
            <div
              className={cn("w-14", index === 1 && "cursor-pointer underline")}
              onClick={() => {
                if (index !== 1) return;
                handleConnectorChange(parentConditionGroup.id);
              }}>
              {connector}
            </div>
          )}
        </div>
        <InputCombobox
          id={`condition-${depth}-${index}-conditionValue`}
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
          id={`condition-${depth}-${index}-conditionOperator`}
          key="conditionOperator"
          showSearch={false}
          options={conditionOperatorOptions}
          value={condition.operator}
          onChangeValue={(val: TSurveyLogicConditionsOperator) => {
            handleOperatorChange(condition, val);
          }}
          comboboxClasses="grow min-w-[150px]"
        />
        {show && (
          <InputCombobox
            id={`condition-${depth}-${index}-conditionMatchValue`}
            withInput={showInput}
            inputProps={{
              type: inputType,
              placeholder: "Value",
            }}
            key="conditionMatchValue"
            showSearch={false}
            groupedOptions={options}
            allowMultiSelect={allowMultiSelect}
            showCheckIcon={allowMultiSelect}
            comboboxClasses="grow min-w-[180px] max-w-[300px]"
            value={condition.rightOperand?.value}
            clearable={true}
            onChangeValue={(val, option) => {
              handleRightOperandChange(condition, val, option);
            }}
          />
        )}
        <DropdownMenu>
          <DropdownMenuTrigger id={`condition-${depth}-${index}-dropdown`}>
            <EllipsisVerticalIcon className="h-4 w-4 text-slate-700 hover:text-slate-950" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              onClick={() => {
                handleAddConditionBelow(condition.id);
              }}
              icon={<PlusIcon className="h-4 w-4" />}>
              Add condition below
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={depth === 0 && conditions.conditions.length === 1}
              onClick={() => handleRemoveCondition(condition.id)}
              icon={<TrashIcon className="h-4 w-4" />}>
              Remove
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleDuplicateCondition(condition.id)}
              icon={<CopyIcon className="h-4 w-4" />}>
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleCreateGroup(condition.id)}
              icon={<WorkflowIcon className="h-4 w-4" />}>
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
