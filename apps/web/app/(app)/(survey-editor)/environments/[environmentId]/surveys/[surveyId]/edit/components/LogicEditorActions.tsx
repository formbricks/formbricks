import {
  actionObjectiveOptions,
  getActionOperatorOptions,
  getActionTargetOptions,
  getActionValueOptions,
  getActionVariableOptions,
} from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/lib/utils";
import { createId } from "@paralleldrive/cuid2";
import { CopyIcon, CornerDownRightIcon, EllipsisVerticalIcon, PlusIcon, TrashIcon } from "lucide-react";
import { getUpdatedActionBody } from "@formbricks/lib/surveyLogic/utils";
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
} from "@formbricks/ui/components/DropdownMenu";
import { InputCombobox } from "@formbricks/ui/components/InputCombobox";

interface LogicEditorActions {
  localSurvey: TSurvey;
  logicItem: TSurveyLogic;
  logicIdx: number;
  question: TSurveyQuestion;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  questionIdx: number;
}

export function LogicEditorActions({
  localSurvey,
  logicItem,
  logicIdx,
  question,
  updateQuestion,
  questionIdx,
}: LogicEditorActions) {
  const actions = logicItem.actions;

  const handleActionsChange = (
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
        actionsClone.splice(actionIdx + 1, 0, { id: createId(), objective: "jumpToQuestion", target: "" });
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
  };

  const handleObjectiveChange = (actionIdx: number, objective: TActionObjective) => {
    const action = actions[actionIdx];
    const actionBody = getUpdatedActionBody(action, objective);
    handleActionsChange("update", actionIdx, actionBody);
  };

  const handleValuesChange = (actionIdx: number, values: Partial<TSurveyLogicAction>) => {
    const action = actions[actionIdx];
    const actionBody = { ...action, ...values } as TSurveyLogicAction;
    handleActionsChange("update", actionIdx, actionBody);
  };

  return (
    <div className="flex grow gap-2">
      <CornerDownRightIcon className="mt-3 h-4 w-4 shrink-0" />
      <div className="flex grow flex-col gap-y-2">
        {actions?.map((action, idx) => (
          <div key={action.id} className="flex grow items-center justify-between gap-x-2">
            <div className="block w-9 shrink-0">{idx === 0 ? "Then" : "and"}</div>
            <div className="flex grow items-center gap-x-2">
              <InputCombobox
                id={`action-${idx}-objective`}
                key={`objective-${action.id}`}
                showSearch={false}
                options={actionObjectiveOptions}
                value={action.objective}
                onChangeValue={(val: TActionObjective) => {
                  handleObjectiveChange(idx, val);
                }}
                comboboxClasses="grow"
              />
              {action.objective !== "calculate" && (
                <InputCombobox
                  id={`action-${idx}-target`}
                  key={`target-${action.id}`}
                  showSearch={false}
                  options={getActionTargetOptions(action, localSurvey, questionIdx)}
                  value={action.target}
                  onChangeValue={(val: string) => {
                    handleValuesChange(idx, {
                      target: val,
                    });
                  }}
                  comboboxClasses="grow"
                />
              )}
              {action.objective === "calculate" && (
                <>
                  <InputCombobox
                    id={`action-${idx}-variableId`}
                    key={`variableId-${action.id}`}
                    showSearch={false}
                    options={getActionVariableOptions(localSurvey)}
                    value={action.variableId}
                    onChangeValue={(val: string) => {
                      handleValuesChange(idx, {
                        variableId: val,
                        value: {
                          type: "static",
                          value: "",
                        },
                      });
                    }}
                    comboboxClasses="grow"
                    emptyDropdownText="Add a variable to calculate"
                  />
                  <InputCombobox
                    id={`action-${idx}-operator`}
                    key={`operator-${action.id}`}
                    showSearch={false}
                    options={getActionOperatorOptions(
                      localSurvey.variables.find((v) => v.id === action.variableId)?.type
                    )}
                    value={action.operator}
                    onChangeValue={(
                      val: TActionTextVariableCalculateOperator | TActionNumberVariableCalculateOperator
                    ) => {
                      handleValuesChange(idx, {
                        operator: val,
                      });
                    }}
                    comboboxClasses="grow"
                  />
                  <InputCombobox
                    id={`action-${idx}-value`}
                    key={`value-${action.id}`}
                    withInput={true}
                    clearable={true}
                    value={action.value?.value ?? ""}
                    inputProps={{
                      placeholder: "Value",
                      type: localSurvey.variables.find((v) => v.id === action.variableId)?.type || "text",
                    }}
                    groupedOptions={getActionValueOptions(action.variableId, localSurvey)}
                    onChangeValue={(val, option, fromInput) => {
                      const fieldType = option?.meta?.type as TActionVariableValueType;

                      if (!fromInput && fieldType !== "static") {
                        handleValuesChange(idx, {
                          value: {
                            type: fieldType,
                            value: val as string,
                          },
                        });
                      } else if (fromInput) {
                        handleValuesChange(idx, {
                          value: {
                            type: "static",
                            value: val as string,
                          },
                        });
                      }
                    }}
                    comboboxClasses="grow shrink-0"
                  />
                </>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger id={`actions-${idx}-dropdown`}>
                <EllipsisVerticalIcon className="h-4 w-4 text-slate-700 hover:text-slate-950" />
              </DropdownMenuTrigger>

              <DropdownMenuContent>
                <DropdownMenuItem
                  className="flex items-center gap-2"
                  onClick={() => {
                    handleActionsChange("addBelow", idx);
                  }}>
                  <PlusIcon className="h-4 w-4" />
                  Add action below
                </DropdownMenuItem>

                <DropdownMenuItem
                  className="flex items-center gap-2"
                  disabled={actions.length === 1}
                  onClick={() => {
                    handleActionsChange("remove", idx);
                  }}>
                  <TrashIcon className="h-4 w-4" />
                  Remove
                </DropdownMenuItem>

                <DropdownMenuItem
                  className="flex items-center gap-2"
                  onClick={() => {
                    handleActionsChange("duplicate", idx);
                  }}>
                  <CopyIcon className="h-4 w-4" />
                  Duplicate
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>
    </div>
  );
}
