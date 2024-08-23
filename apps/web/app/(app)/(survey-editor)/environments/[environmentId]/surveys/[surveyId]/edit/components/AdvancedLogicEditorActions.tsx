import {
  getActionOpeartorOptions,
  getActionTargetOptions,
  getActionValueOptions,
  getActionVariableOptions,
} from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/lib/util";
import { CopyIcon, CornerDownRightIcon, MoreVerticalIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { actionObjectiveOptions } from "@formbricks/lib/survey/logic/utils";
import {
  TAction,
  TActionCalculateVariableType,
  TActionNumberVariableCalculateOperator,
  TActionObjective,
  TActionTextVariableCalculateOperator,
  TDyanmicLogicField,
  TSurveyAdvancedLogic,
} from "@formbricks/types/surveys/logic";
import { TSurvey } from "@formbricks/types/surveys/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@formbricks/ui/DropdownMenu";
import { InputCombobox } from "@formbricks/ui/InputCombobox";

interface AdvancedLogicEditorActions {
  localSurvey: TSurvey;
  logicItem: TSurveyAdvancedLogic;
  handleActionsChange: (
    operation: "delete" | "addBelow" | "duplicate" | "update",
    actionIdx: number,
    action?: Partial<TAction>
  ) => void;
  userAttributes: string[];
  questionIdx: number;
}

export function AdvancedLogicEditorActions({
  localSurvey,
  logicItem,
  handleActionsChange,
  userAttributes,
  questionIdx,
}: AdvancedLogicEditorActions) {
  const actions = logicItem.actions;

  const updateAction = (actionIdx: number, updatedAction: Partial<TAction>) => {
    handleActionsChange("update", actionIdx, updatedAction);
  };

  console.log("actions", actions);
  return (
    <div className="">
      <div className="flex gap-2">
        <CornerDownRightIcon className="mt-2 h-5 w-5" />
        <div className="flex w-full flex-col gap-y-2">
          {actions.map((action, idx) => (
            <div className="flex w-full items-center justify-between gap-4">
              <span>{idx === 0 ? "Then" : "and"}</span>
              <div className="flex grow items-center gap-1">
                <InputCombobox
                  key="objective"
                  showSearch={false}
                  options={actionObjectiveOptions}
                  selected={action.objective}
                  onChangeValue={(val: TActionObjective) => {
                    updateAction(idx, {
                      objective: val,
                      target: "",
                      operator: undefined,
                      variableType: undefined,
                    });
                  }}
                  comboboxClasses="max-w-[200px]"
                />
                <InputCombobox
                  key="target"
                  showSearch={false}
                  options={
                    action.objective === "calculate"
                      ? getActionVariableOptions(localSurvey)
                      : getActionTargetOptions(localSurvey, questionIdx)
                  }
                  selected={action.target}
                  onChangeValue={(val: string, option) => {
                    updateAction(idx, {
                      target: val,
                      variableType: option?.meta?.variableType as TActionCalculateVariableType,
                    });
                  }}
                  comboboxClasses="grow min-w-[100px]"
                />
                {action.objective === "calculate" && (
                  <>
                    <InputCombobox
                      key="attribute"
                      showSearch={false}
                      options={getActionOpeartorOptions(action.variableType)}
                      selected={action.operator}
                      onChangeValue={(
                        val: TActionNumberVariableCalculateOperator | TActionTextVariableCalculateOperator
                      ) => {
                        updateAction(idx, {
                          operator: val,
                        });
                      }}
                      comboboxClasses="min-w-[100px]"
                    />
                    <InputCombobox
                      key="value"
                      withInput={true}
                      inputProps={{
                        placeholder: "Value",
                        value: typeof action.value !== "object" ? action.value : "",
                        type: action.variableType,
                        onChange: (e) => {
                          let val: string | number = e.target.value;

                          if (action.variableType === "number") {
                            val = Number(val);
                            updateAction(idx, {
                              value: val,
                            });
                          } else if (action.variableType === "text") {
                            updateAction(idx, {
                              value: val,
                            });
                          }
                        },
                      }}
                      groupedOptions={getActionValueOptions(localSurvey, questionIdx, userAttributes)}
                      onChangeValue={(val: string, option) => {
                        updateAction(idx, {
                          value: {
                            id: val,
                            fieldType: option?.meta?.fieldType as TDyanmicLogicField,
                            type: "dynamic",
                          },
                        });
                      }}
                      comboboxClasses="flex min-w-[100px]"
                      comboboxSize="sm"
                    />
                  </>
                )}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger>
                  <MoreVerticalIcon className="h-4 w-4" />
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
                      handleActionsChange("delete", idx);
                    }}>
                    <Trash2Icon className="h-4 w-4" />
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
    </div>
  );
}
