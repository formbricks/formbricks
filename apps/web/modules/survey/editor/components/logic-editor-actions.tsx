"use client";

import { getUpdatedActionBody } from "@/lib/surveyLogic/utils";
import {
  getActionObjectiveOptions,
  getActionOperatorOptions,
  getActionTargetOptions,
  getActionValueOptions,
  getActionVariableOptions,
  hasJumpToQuestionAction,
} from "@/modules/survey/editor/lib/utils";
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { InputCombobox } from "@/modules/ui/components/input-combo-box";
import { cn } from "@/modules/ui/lib/utils";
import { createId } from "@paralleldrive/cuid2";
import { useTranslate } from "@tolgee/react";
import { CopyIcon, CornerDownRightIcon, EllipsisVerticalIcon, PlusIcon, TrashIcon } from "lucide-react";
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
  const { t } = useTranslate();
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
        actionsClone.splice(actionIdx + 1, 0, {
          id: createId(),
          objective: hasJumpToQuestionAction(logicItem.actions) ? "requireAnswer" : "jumpToQuestion",
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

  const filteredObjectiveOptions = getActionObjectiveOptions(t).filter(
    (option) => option.value !== "jumpToQuestion"
  );

  const jumpToQuestionActionIdx = actions.findIndex((action) => action.objective === "jumpToQuestion");

  return (
    <div className="flex grow flex-col gap-2">
      <div className="flex w-10 shrink-0 items-center justify-end font-medium text-slate-900">
        {t("environments.surveys.edit.then")}
      </div>

      <div className="flex grow flex-col gap-y-2 border-b border-slate-200 last:pb-3">
        {actions?.map((action, idx) => (
          <div className="flex items-center gap-x-2" key={action.id}>
            <div className="flex w-10 shrink-0 items-center justify-end">
              <CornerDownRightIcon className="h-4 w-4 shrink-0 text-slate-500" />
            </div>
            <div key={action.id} className="flex grow items-center justify-between gap-x-2">
              <div className={cn("grid flex-1 grid-cols-12 gap-x-2")}>
                <div
                  className={cn(
                    action.objective !== "calculate" && "col-span-4",
                    action.objective === "calculate" && "col-span-3"
                  )}>
                  <InputCombobox
                    id={`action-${idx}-objective`}
                    key={`objective-${action.id}`}
                    showSearch={false}
                    options={
                      jumpToQuestionActionIdx === -1 || idx === jumpToQuestionActionIdx
                        ? getActionObjectiveOptions(t)
                        : filteredObjectiveOptions
                    }
                    value={action.objective}
                    onChangeValue={(val: TActionObjective) => {
                      handleObjectiveChange(idx, val);
                    }}
                    comboboxClasses="grow"
                  />
                </div>

                {action.objective !== "calculate" && (
                  <div className="col-span-8">
                    <InputCombobox
                      id={`action-${idx}-target`}
                      key={`target-${action.id}`}
                      showSearch={false}
                      options={getActionTargetOptions(action, localSurvey, questionIdx, t)}
                      value={action.target}
                      onChangeValue={(val: string) => {
                        handleValuesChange(idx, {
                          target: val,
                        });
                      }}
                      comboboxClasses="grow"
                    />
                  </div>
                )}

                {action.objective === "calculate" && (
                  <>
                    <div className="col-span-3">
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
                        emptyDropdownText={t("environments.surveys.edit.add_a_variable_to_calculate")}
                      />
                    </div>

                    <div className="col-span-3">
                      <InputCombobox
                        id={`action-${idx}-operator`}
                        key={`operator-${action.id}`}
                        showSearch={false}
                        options={getActionOperatorOptions(
                          t,
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
                    </div>

                    <div className="col-span-3">
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
                        groupedOptions={getActionValueOptions(action.variableId, localSurvey, questionIdx, t)}
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
                    </div>
                  </>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger id={`actions-${idx}-dropdown`} asChild>
                  <Button
                    variant="outline"
                    className="flex h-10 w-10 items-center justify-center rounded-md bg-white">
                    <EllipsisVerticalIcon className="h-4 w-4 text-slate-700 hover:text-slate-950" />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent>
                  <DropdownMenuItem
                    onClick={() => {
                      handleActionsChange("addBelow", idx);
                    }}
                    icon={<PlusIcon className="h-4 w-4" />}>
                    {t("environments.surveys.edit.add_action_below")}
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    disabled={actions.length === 1}
                    onClick={() => {
                      handleActionsChange("remove", idx);
                    }}
                    icon={<TrashIcon className="h-4 w-4" />}>
                    {t("common.remove")}
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => {
                      handleActionsChange("duplicate", idx);
                    }}
                    icon={<CopyIcon className="h-4 w-4" />}>
                    {t("common.duplicate")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
