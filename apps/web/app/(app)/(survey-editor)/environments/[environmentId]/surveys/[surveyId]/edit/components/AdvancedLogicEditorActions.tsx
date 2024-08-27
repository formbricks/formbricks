import {
  actionObjectiveOptions,
  getActionOpeartorOptions,
  getActionTargetOptions,
  getActionValueOptions,
  getActionVariableOptions,
} from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/lib/util";
import { createId } from "@paralleldrive/cuid2";
import { CopyIcon, CornerDownRightIcon, MoreVerticalIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { getUpdatedActionBody } from "@formbricks/lib/survey/logic/utils";
import {
  TAction,
  TActionObjective,
  TActionVariableCalculateOperator,
  TActionVariableValueType,
  TSurveyAdvancedLogic,
  ZAction,
} from "@formbricks/types/surveys/logic";
import { TSurvey, TSurveyQuestion } from "@formbricks/types/surveys/types";
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
  logicIdx: number;
  question: TSurveyQuestion;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  questionIdx: number;
}

export function AdvancedLogicEditorActions({
  localSurvey,
  logicItem,
  logicIdx,
  question,
  updateQuestion,
  questionIdx,
}: AdvancedLogicEditorActions) {
  const actions = logicItem.actions;

  const handleActionsChange = (
    operation: "delete" | "addBelow" | "duplicate" | "update",
    actionIdx: number,
    action?: TAction
  ) => {
    const logicCopy = structuredClone(question.logic) || [];
    const logicItem = logicCopy[logicIdx];
    const actionsClone = logicItem.actions;

    if (operation === "delete") {
      actionsClone.splice(actionIdx, 1);
    } else if (operation === "addBelow") {
      actionsClone.splice(actionIdx + 1, 0, { id: createId(), objective: "jumpToQuestion", target: "" });
    } else if (operation === "duplicate") {
      actionsClone.splice(actionIdx + 1, 0, { ...actionsClone[actionIdx], id: createId() });
    } else if (operation === "update") {
      if (!action) return;
      actionsClone[actionIdx] = action;
    }

    updateQuestion(questionIdx, {
      logic: logicCopy,
    });
  };

  function updateAction(actionIdx: number, updateActionBody: Partial<TAction>) {
    const action = actions[actionIdx];
    const actionBody = getUpdatedActionBody(action, updateActionBody);
    const parsedActionBodyResult = ZAction.safeParse(actionBody);
    if (!parsedActionBodyResult.success) {
      console.error("Failed to update action", parsedActionBodyResult.error.errors);
      return;
    }
    handleActionsChange("update", actionIdx, parsedActionBodyResult.data);
  }

  return (
    <div className="">
      <div className="flex gap-2">
        <CornerDownRightIcon className="mt-2 h-5 w-5" />
        <div className="flex w-full flex-col gap-y-2">
          {actions.map((action, idx) => (
            <div className="flex w-full items-center justify-between gap-4">
              <span className="text-sm">{idx === 0 ? "Then" : "and"}</span>
              <div className="flex grow items-center gap-1">
                <InputCombobox
                  key="objective"
                  showSearch={false}
                  options={actionObjectiveOptions}
                  selected={action.objective}
                  onChangeValue={(val: TActionObjective) => {
                    updateAction(idx, {
                      objective: val,
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
                  selected={action.objective === "calculate" ? action.variableId : action.target}
                  onChangeValue={(val: string) => {
                    updateAction(idx, {
                      ...(action.objective === "calculate" ? { variableId: val } : { target: val }),
                    });
                  }}
                  comboboxClasses="grow min-w-[100px]"
                />
                {action.objective === "calculate" && (
                  <>
                    <InputCombobox
                      key="attribute"
                      showSearch={false}
                      options={getActionOpeartorOptions(
                        localSurvey.variables.find((v) => v.id === action.variableId)?.type
                      )}
                      selected={action.operator}
                      onChangeValue={(val: TActionVariableCalculateOperator) => {
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
                        value: action.value?.value ?? "",
                        type: localSurvey.variables.find((v) => v.id === action.variableId)?.type || "text",
                        onChange: (e) => {
                          let val: string | number = e.target.value;

                          const variable = localSurvey.variables.find((v) => v.id === action.variableId);
                          if (variable?.type === "number") {
                            val = Number(val);
                          }
                          updateAction(idx, {
                            value: {
                              type: "static",
                              value: val,
                            },
                          });
                        },
                      }}
                      groupedOptions={getActionValueOptions(action.variableId, localSurvey, questionIdx)}
                      onChangeValue={(val: string, option) => {
                        updateAction(idx, {
                          value: {
                            type: option?.meta?.type as TActionVariableValueType,
                            value: val,
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
