import {
  getConditionOperatorOptions,
  getConditionValueOptions,
  getMatchValueProps,
} from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/lib/util";
import { createId } from "@paralleldrive/cuid2";
import { CopyIcon, MoreVerticalIcon, PlusIcon, Trash2Icon, WorkflowIcon } from "lucide-react";
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
import { InputCombobox } from "@formbricks/ui/InputCombobox";

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

  console.log("conditions", conditions);

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
            <div className="text-sm">When</div>
          ) : (
            <div
              className={cn("w-14 text-sm", { "cursor-pointer underline": index === 1 })}
              onClick={() => {
                if (index !== 1) return;
                handleConnectorChange(parentConditionGroup.id);
              }}>
              {connector}
            </div>
          )}
          <div className="mt-2 rounded-lg border border-slate-200 bg-slate-100 p-4">
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
                        id: localSurvey.questions[questionIdx].id,
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
                  <Trash2Icon className="h-4 w-4" />
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
    const { show, options, showInput = true } = getMatchValueProps(condition, localSurvey);

    return (
      <div key={condition.id} className="mt-2 flex items-center justify-between gap-4">
        {index === 0 ? (
          <div className="text-sm">When</div>
        ) : (
          <div
            className={cn("w-14 text-sm", { "cursor-pointer underline": index === 1 })}
            onClick={() => {
              if (index !== 1) return;
              handleConnectorChange(parentConditionGroup.id);
            }}>
            {connector}
          </div>
        )}
        <InputCombobox
          key="conditionValue"
          showSearch={false}
          groupedOptions={conditionValueOptions}
          selected={condition.leftOperand.id}
          onChangeValue={(val: string, option) => {
            handleUpdateCondition(condition.id, {
              leftOperand: {
                id: val,
                type: option?.meta?.type as TDyanmicLogicField,
              },
            });
          }}
          comboboxClasses="grow max-w-[200px]"
        />
        <InputCombobox
          key="conditionOperator"
          showSearch={false}
          options={conditionOperatorOptions}
          selected={condition.operator}
          onChangeValue={(val: TSurveyLogicCondition) => {
            handleUpdateCondition(condition.id, {
              operator: val,
            });
          }}
          comboboxClasses="grow"
        />
        {show && options.length > 0 && (
          <InputCombobox
            withInput={showInput}
            inputProps={{
              placeholder: "Value",
              onChange: (e) => {
                handleUpdateCondition(condition.id, {
                  rightOperand: {
                    type: "static",
                    value: e.target.value,
                  },
                });
              },
            }}
            key="conditionMatchValue"
            showSearch={false}
            groupedOptions={options}
            comboboxSize="sm"
            selected={condition.rightOperand?.value}
            onChangeValue={(val: TRightOperand["value"], option) => {
              handleUpdateCondition(condition.id, {
                rightOperand: {
                  value: val,
                  type: option?.meta?.type as TRightOperand["type"],
                },
              });
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
                    id: localSurvey.questions[questionIdx].id,
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
              <Trash2Icon className="h-4 w-4" />
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
    <div className="flex flex-col gap-4">
      {conditions.conditions.map((condition, index) => renderCondition(condition, index, conditions))}
    </div>
  );
}
