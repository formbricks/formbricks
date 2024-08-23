import {
  getConditionOperatorOptions,
  getConditionValueOptions,
  getMatchValueProps,
} from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/lib/util";
import { createId } from "@paralleldrive/cuid2";
import { CopyIcon, MoreVerticalIcon, PlusIcon, Trash2Icon, WorkflowIcon } from "lucide-react";
import { cn } from "@formbricks/lib/cn";
import { performOperationsOnConditions } from "@formbricks/lib/survey/logic/utils";
import { TConditionBase, TSurveyAdvancedLogic, TSurveyLogicCondition } from "@formbricks/types/surveys/logic";
import { TSurvey, TSurveyQuestion } from "@formbricks/types/surveys/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@formbricks/ui/DropdownMenu";
import { InputCombobox } from "@formbricks/ui/InputCombobox";

interface AdvancedLogicEditorConditions {
  conditions: TSurveyAdvancedLogic["conditions"];
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  question: TSurveyQuestion;
  localSurvey: TSurvey;
  questionIdx: number;
  logicIdx: number;
  userAttributes: string[];
}

export function AdvancedLogicEditorConditions({
  conditions,
  logicIdx,
  question,
  localSurvey,
  questionIdx,
  updateQuestion,
  userAttributes,
}: AdvancedLogicEditorConditions) {
  const handleAddConditionBelow = (resourceId: string, condition: Partial<TConditionBase>) => {
    const advancedLogicCopy = structuredClone(question.advancedLogic) || [];

    performOperationsOnConditions({
      action: "addConditionBelow",
      advancedLogicCopy,
      logicIdx,
      resourceId,
      condition,
    });

    updateQuestion(questionIdx, {
      advancedLogic: advancedLogicCopy,
    });
  };

  const handleConnectorChange = (resourceId: string, connector: TConditionBase["connector"]) => {
    if (!connector) return;
    const advancedLogicCopy = structuredClone(question.advancedLogic) || [];

    performOperationsOnConditions({
      action: "toggleConnector",
      advancedLogicCopy,
      logicIdx,
      resourceId,
    });

    updateQuestion(questionIdx, {
      advancedLogic: advancedLogicCopy,
    });
  };

  const handleRemoveCondition = (resourceId: string) => {
    const advancedLogicCopy = structuredClone(question.advancedLogic) || [];

    performOperationsOnConditions({
      action: "removeCondition",
      advancedLogicCopy,
      logicIdx,
      resourceId,
    });

    updateQuestion(questionIdx, {
      advancedLogic: advancedLogicCopy,
    });
  };

  const handleDuplicateCondition = (resourceId: string) => {
    const advancedLogicCopy = structuredClone(question.advancedLogic) || [];

    performOperationsOnConditions({ action: "duplicateCondition", advancedLogicCopy, logicIdx, resourceId });

    updateQuestion(questionIdx, {
      advancedLogic: advancedLogicCopy,
    });
  };

  const handleCreateGroup = (resourceId: string) => {
    const advancedLogicCopy = structuredClone(question.advancedLogic) || [];

    performOperationsOnConditions({
      action: "createGroup",
      advancedLogicCopy,
      logicIdx,
      resourceId,
    });

    updateQuestion(questionIdx, {
      advancedLogic: advancedLogicCopy,
    });
  };

  const handleUpdateCondition = (resourceId: string, updateConditionBody: Partial<TConditionBase>) => {
    const advancedLogicCopy = structuredClone(question.advancedLogic) || [];

    performOperationsOnConditions({
      action: "updateCondition",
      advancedLogicCopy,
      logicIdx,
      resourceId,
      conditionBody: updateConditionBody,
    });

    updateQuestion(questionIdx, {
      advancedLogic: advancedLogicCopy,
    });
  };

  console.log("conditions", conditions);

  return (
    <div className="flex flex-col gap-4 rounded-lg">
      {conditions.map((condition) => {
        const { connector, id, type } = condition;

        if (type === "group") {
          return (
            <div key={id} className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-2">
                <div className="mt-1 w-auto" key={connector}>
                  <span
                    className={cn(Boolean(connector) && "cursor-pointer underline", "text-sm")}
                    onClick={() => {
                      if (!connector) return;
                      handleConnectorChange(id, connector);
                    }}>
                    {connector ? connector : "When"}
                  </span>
                </div>
              </div>
              <div className="w-full rounded-lg border border-slate-200 bg-slate-100 p-4">
                <AdvancedLogicEditorConditions
                  conditions={condition.conditions}
                  key={id}
                  updateQuestion={updateQuestion}
                  localSurvey={localSurvey}
                  question={question}
                  questionIdx={questionIdx}
                  logicIdx={logicIdx}
                  userAttributes={userAttributes}
                />
              </div>
              <div className="mt-1">
                <DropdownMenu key={`group-actions-${id}`}>
                  <DropdownMenuTrigger key={`group-actions-${id}`}>
                    <MoreVerticalIcon className="h-4 w-4" />
                  </DropdownMenuTrigger>

                  <DropdownMenuContent>
                    <DropdownMenuItem
                      className="flex items-center gap-2"
                      disabled={conditions.length === 1}
                      onClick={() => {
                        handleRemoveCondition(id);
                      }}>
                      <Trash2Icon className="h-4 w-4" />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        }

        const conditionValueOptions = getConditionValueOptions(localSurvey, questionIdx, userAttributes);
        const conditionOperatorOptions = getConditionOperatorOptions(condition);
        const { show, options } = getMatchValueProps(localSurvey, condition, questionIdx, userAttributes);
        return (
          <div key={id} className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-2">
              <div className="w-auto" key={connector}>
                <span
                  className={cn(Boolean(connector) && "cursor-pointer underline", "text-sm")}
                  onClick={() => {
                    if (!connector) return;
                    handleConnectorChange(id, connector);
                  }}>
                  {connector ? connector : "When"}
                </span>
              </div>
            </div>
            <InputCombobox
              key="conditionValue"
              showSearch={false}
              groupedOptions={conditionValueOptions}
              selected={condition.conditionValue}
              onChangeValue={(val: string, option) => {
                handleUpdateCondition(id, {
                  conditionValue: val,
                  ...option?.meta,
                });
              }}
              comboboxClasses="grow"
            />
            <InputCombobox
              key="conditionOperator"
              showSearch={false}
              options={conditionOperatorOptions}
              selected={condition.conditionOperator}
              onChangeValue={(val: TSurveyLogicCondition, option) => {
                console.log("val", val, option);
                handleUpdateCondition(id, {
                  conditionOperator: val,
                });
              }}
              comboboxClasses="grow"
            />
            {show && options.length > 0 && (
              <InputCombobox
                withInput
                key="conditionMatchValue"
                showSearch={false}
                groupedOptions={options}
                comboboxSize="sm"
                selected={condition.conditionValue}
                onChangeValue={() => {}}
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
                    handleAddConditionBelow(id, {
                      id: createId(),
                      connector: "and",
                      conditionValue: localSurvey.questions[questionIdx].id,
                      type: "question",
                      questionType: localSurvey.questions[questionIdx].type,
                    });
                  }}>
                  <PlusIcon className="h-4 w-4" />
                  Add condition below
                </DropdownMenuItem>

                <DropdownMenuItem
                  className="flex items-center gap-2"
                  disabled={conditions.length === 1}
                  onClick={() => {
                    handleRemoveCondition(id);
                  }}>
                  <Trash2Icon className="h-4 w-4" />
                  Remove
                </DropdownMenuItem>

                <DropdownMenuItem
                  className="flex items-center gap-2"
                  onClick={() => {
                    handleDuplicateCondition(id);
                  }}>
                  <CopyIcon className="h-4 w-4" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="flex items-center gap-2"
                  onClick={() => {
                    handleCreateGroup(id);
                  }}>
                  <WorkflowIcon className="h-4 w-4" />
                  Create group
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      })}
    </div>
  );
}
