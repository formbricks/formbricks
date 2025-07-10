"use client";

import {
  addConditionBelow,
  createGroupFromResource,
  duplicateCondition,
  isConditionGroup,
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
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { InputCombobox, TComboboxOption } from "@/modules/ui/components/input-combo-box";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { cn } from "@/modules/ui/lib/utils";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { createId } from "@paralleldrive/cuid2";
import { useTranslate } from "@tolgee/react";
import { CopyIcon, EllipsisVerticalIcon, PlusIcon, TrashIcon, WorkflowIcon } from "lucide-react";
import {
  TConditionGroup,
  TDynamicLogicField,
  TRightOperand,
  TSingleCondition,
  TSurvey,
  TSurveyLogicConditionsOperator,
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
  const [parent] = useAutoAnimate();

  const handleAddConditionBelow = (resourceId: string) => {
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
    const type = option?.meta?.type as TDynamicLogicField;
    if (type === "question") {
      const [questionId, rowId] = value.split(".");
      const question = localSurvey.questions.find((q) => q.id === questionId);

      if (question && question.type === TSurveyQuestionTypeEnum.Matrix) {
        if (value.includes(".")) {
          // Matrix question with rowId is selected
          handleUpdateCondition(condition.id, {
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
          return;
        }
      }
    }

    handleUpdateCondition(condition.id, {
      leftOperand: {
        value,
        type,
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

  const getLeftOperandValue = (condition: TSingleCondition) => {
    if (condition.leftOperand.type === "question") {
      const question = localSurvey.questions.find((q) => q.id === condition.leftOperand.value);
      if (question && question.type === TSurveyQuestionTypeEnum.Matrix) {
        if (condition.leftOperand?.meta?.row !== undefined) {
          return `${condition.leftOperand.value}.${condition.leftOperand.meta.row}`;
        }
      }
    }

    return condition.leftOperand.value;
  };

  const renderCondition = (
    condition: TSingleCondition | TConditionGroup,
    index: number,
    parentConditionGroup: TConditionGroup
  ) => {
    const connector = parentConditionGroup.connector;

    if (isConditionGroup(condition)) {
      return (
        <div key={condition.id} className="flex items-start gap-x-2">
          {index > 0 ? <div className="w-10 shrink-0">{connector}</div> : null}
          <div className="relative flex w-full items-center gap-x-2 rounded-lg border border-slate-400 p-3">
            <div className="flex-1">
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

            <div className="absolute right-3 top-3">
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <Button
                    variant="secondary"
                    className="flex h-10 w-10 items-center justify-center rounded-md">
                    <EllipsisVerticalIcon className="h-4 w-4 text-slate-700 hover:text-slate-950" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem
                    onClick={() => {
                      handleAddConditionBelow(condition.id);
                    }}
                    icon={<PlusIcon className="h-4 w-4" />}>
                    {t("environments.surveys.edit.add_condition_below")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={depth === 0 && conditions.conditions.length === 1}
                    onClick={() => handleRemoveCondition(condition.id)}
                    icon={<TrashIcon className="h-4 w-4" />}>
                    {t("common.remove")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      );
    }

    const conditionValueOptions = getConditionValueOptions(localSurvey, questionIdx, t);
    const conditionOperatorOptions = getConditionOperatorOptions(condition, localSurvey, t);
    const {
      show,
      options,
      showInput = false,
      inputType,
    } = getMatchValueProps(condition, localSurvey, questionIdx, t);

    const allowMultiSelect = [
      "equalsOneOf",
      "includesAllOf",
      "includesOneOf",
      "doesNotIncludeOneOf",
      "doesNotIncludeAllOf",
      "isAnyOf",
    ].includes(condition.operator);

    return (
      <div key={condition.id} className="flex items-center gap-x-2">
        <div className="w-10 shrink-0">{index > 0 ? <div>{connector}</div> : null}</div>

        <div className="grid w-full flex-1 grid-cols-12 gap-x-2">
          <div className="col-span-5">
            <InputCombobox
              id={`condition-${depth}-${index}-conditionValue`}
              key="conditionValue"
              showSearch
              groupedOptions={conditionValueOptions}
              value={getLeftOperandValue(condition)}
              onChangeValue={(val: string, option) => {
                handleQuestionChange(condition, val, option);
              }}
            />
          </div>
          <div className={cn(show && "col-span-3", !show && "col-span-7")}>
            <InputCombobox
              id={`condition-${depth}-${index}-conditionOperator`}
              key="conditionOperator"
              showSearch={false}
              options={conditionOperatorOptions}
              value={condition.operator}
              onChangeValue={(val: TSurveyLogicConditionsOperator) => {
                handleOperatorChange(condition, val);
              }}
            />
          </div>
          <div className="col-span-4">
            {show && (
              <InputCombobox
                id={`condition-${depth}-${index}-conditionMatchValue`}
                withInput={showInput}
                inputProps={{
                  type: inputType,
                  placeholder: t("environments.surveys.edit.select_or_type_value"),
                }}
                key="conditionMatchValue"
                showSearch={false}
                groupedOptions={options}
                allowMultiSelect={allowMultiSelect}
                showCheckIcon={allowMultiSelect}
                value={condition.rightOperand?.value}
                clearable={true}
                onChangeValue={(val, option) => {
                  handleRightOperandChange(condition, val, option);
                }}
              />
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger id={`condition-${depth}-${index}-dropdown`}>
            <Button
              variant="outline"
              className="flex h-10 w-10 items-center justify-center rounded-md bg-white">
              <EllipsisVerticalIcon className="h-4 w-4 text-slate-700 hover:text-slate-950" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              onClick={() => {
                handleAddConditionBelow(condition.id);
              }}
              icon={<PlusIcon className="h-4 w-4" />}>
              {t("environments.surveys.edit.add_condition_below")}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={depth === 0 && conditions.conditions.length === 1}
              onClick={() => handleRemoveCondition(condition.id)}
              icon={<TrashIcon className="h-4 w-4" />}>
              {t("common.remove")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleDuplicateCondition(condition.id)}
              icon={<CopyIcon className="h-4 w-4" />}>
              {t("common.duplicate")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleCreateGroup(condition.id)}
              icon={<WorkflowIcon className="h-4 w-4" />}>
              {t("environments.surveys.edit.create_group")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  return (
    <div ref={parent} className="flex flex-col gap-y-4">
      {/* Dropdown for changing the connector */}
      <div className="flex items-center text-sm">
        <p className="mr-2 font-semibold text-slate-700">When</p>
        <Select
          value={conditions.connector}
          onValueChange={() => {
            handleConnectorChange(conditions.id);
          }}>
          <SelectTrigger className="w-auto bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {/* <SelectItem value="and">{t("environments.surveys.edit.logic.all_are_true")}</SelectItem>
            <SelectItem value="or">{t("environments.surveys.edit.logic.any_is_true")}</SelectItem> */}
            <SelectItem value="and">all are true</SelectItem>
            <SelectItem value="or">any is true</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-y-2">
        {conditions?.conditions.map((condition, index) => renderCondition(condition, index, conditions))}
      </div>
    </div>
  );
}
