"use client";

import { createId } from "@paralleldrive/cuid2";
import { CopyIcon, CornerDownRightIcon, EllipsisVerticalIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getComputedEmbeddedFields } from "@formbricks/types/embedded-data-resolver";
import { TSurveyBlockLogicAction, TSurveyBlockLogicActionObjective } from "@formbricks/types/surveys/blocks";
import {
  TActionNumberVariableCalculateOperator,
  TActionTextVariableCalculateOperator,
} from "@formbricks/types/surveys/logic";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getUpdatedActionBody } from "@/lib/surveyLogic/utils";
import { SetValueFormula } from "@/modules/survey/editor/components/set-value-formula";
import { oneStepToFormula } from "@/modules/survey/editor/lib/expression-formula";
import { getNextActionObjective, getObjectivesForAction } from "@/modules/survey/editor/lib/rule-list";
import {
  getActionObjectiveOptions,
  getActionOperatorOptions,
  getActionTargetOptions,
  getActionValueOptions,
  getActionVariableOptions,
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

/** The operator-list entry that turns a one-step calculation into a formula; never stored. */
const USE_FORMULA = "useFormula";

interface LogicEditorActionsProps {
  readonly localSurvey: TSurvey;
  readonly actions: TSurveyBlockLogicAction[];
  readonly onActionsChange: (
    updater: (actions: TSurveyBlockLogicAction[]) => TSurveyBlockLogicAction[]
  ) => void;
  /**
   * Where the rule runs: the index of the block it follows. Jumps go to later blocks and endings,
   * values come from that block and earlier ones. `-1` is before the first question (ENG-6932).
   */
  readonly scopeBlockIdx: number;
  readonly isLast?: boolean;
}

export function LogicEditorActions({
  localSurvey,
  actions,
  onActionsChange,
  scopeBlockIdx,
  isLast,
}: LogicEditorActionsProps) {
  const { t } = useTranslation();

  /**
   * ENG-1837: which input widget a calculate action gets is driven by the computed field's declared
   * type. ENG-2628: read off the survey's rows, which the Embedded Data card edits directly, so a
   * retype still reaches this widget on the next render.
   */
  const getCalculateFieldType = (storageKey: string): "text" | "number" | undefined => {
    const dataType = getComputedEmbeddedFields(localSurvey).find(({ link }) => link.storageKey === storageKey)
      ?.field.dataType;
    if (dataType === undefined) return undefined;
    return dataType === "number" ? "number" : "text";
  };

  const handleActionsChange = (
    operation: "remove" | "addBelow" | "duplicate" | "update",
    actionIdx: number,
    action?: TSurveyBlockLogicAction
  ) => {
    if (operation === "update" && !action) return;

    onActionsChange((actionsClone) => {
      switch (operation) {
        case "remove":
          actionsClone.splice(actionIdx, 1);
          break;
        case "addBelow":
          actionsClone.splice(
            actionIdx + 1,
            0,
            getUpdatedActionBody(
              { id: createId(), objective: "jumpToBlock", target: "" },
              getNextActionObjective(actionsClone, scopeBlockIdx)
            )
          );
          break;
        case "duplicate":
          actionsClone.splice(actionIdx + 1, 0, { ...actionsClone[actionIdx], id: createId() });
          break;
        case "update":
          if (action) actionsClone[actionIdx] = action;
          break;
      }
      return actionsClone;
    });
  };

  const handleObjectiveChange = (actionIdx: number, objective: TSurveyBlockLogicActionObjective) => {
    const action = actions[actionIdx];
    const actionBody = getUpdatedActionBody(action, objective);
    handleActionsChange("update", actionIdx, actionBody);
  };

  const handleValuesChange = (actionIdx: number, values: Partial<TSurveyBlockLogicAction>) => {
    const action = actions[actionIdx];
    const actionBody = { ...action, ...values } as TSurveyBlockLogicAction;
    handleActionsChange("update", actionIdx, actionBody);
  };

  // Before the first question a rule may only jump or set a value (ENG-6932); a rule jumps once and
  // marks Low quality once (ENG-6933).
  const objectiveOptions = getActionObjectiveOptions(t);
  const getObjectiveOptions = (actionIdx: number) => {
    const allowed = new Set<string>(getObjectivesForAction(actions, actionIdx, scopeBlockIdx));
    return objectiveOptions.filter((option) => allowed.has(String(option.value)));
  };

  return (
    <div className="flex grow flex-col gap-2">
      <div className="flex w-10 shrink-0 items-center justify-end font-medium text-slate-900">
        {t("workspace.surveys.edit.then")}
      </div>

      <div className={cn("flex grow flex-col gap-y-2 last:pb-3", isLast && "border-b border-slate-200")}>
        {actions?.map((action, idx) => (
          <div className="flex items-center gap-x-2" key={action.id}>
            <div className="flex w-10 shrink-0 items-center justify-end">
              <CornerDownRightIcon className="size-4 shrink-0 text-slate-500" />
            </div>
            <div key={action.id} className="flex grow items-center justify-between gap-x-2">
              <div className={cn("grid flex-1 grid-cols-12 gap-x-2")}>
                <div
                  className={cn(
                    (action.objective === "jumpToBlock" || action.objective === "requireAnswer") &&
                      "col-span-4",
                    action.objective === "calculate" && "col-span-3",
                    // ENG-6933: takes nothing else, so the objective is the whole action.
                    action.objective === "markLowQuality" && "col-span-12"
                  )}>
                  <InputCombobox
                    id={`action-${idx}-objective`}
                    key={`objective-${action.id}`}
                    showSearch={false}
                    options={getObjectiveOptions(idx)}
                    value={action.objective}
                    onChangeValue={(val: string | number | string[]) => {
                      handleObjectiveChange(idx, val as TSurveyBlockLogicActionObjective);
                    }}
                    comboboxClasses="grow"
                  />
                </div>

                {(action.objective === "jumpToBlock" || action.objective === "requireAnswer") && (
                  <div className="col-span-8">
                    <InputCombobox
                      id={`action-${idx}-target`}
                      key={`target-${action.id}`}
                      showSearch={true}
                      options={getActionTargetOptions(action, localSurvey, scopeBlockIdx, t)}
                      value={action.target}
                      onChangeValue={(val: string | number | string[]) => {
                        handleValuesChange(idx, {
                          target: String(val),
                        });
                      }}
                      comboboxClasses="grow"
                    />
                  </div>
                )}

                {action.objective === "calculate" && action.value.type === "expression" && (
                  <>
                    <div className="col-span-3">
                      <InputCombobox
                        id={`action-${idx}-variableId`}
                        key={`variableId-${action.id}`}
                        showSearch={false}
                        options={getActionVariableOptions(localSurvey)}
                        value={action.variableId}
                        onChangeValue={(val: string | number | string[]) => {
                          // The formula stays: a field of another type shows what no longer fits.
                          handleValuesChange(idx, { variableId: String(val) });
                        }}
                        comboboxClasses="grow"
                        emptyDropdownText={t("workspace.surveys.edit.add_a_variable_to_calculate")}
                      />
                    </div>
                    <div className="col-span-6 flex items-center text-sm text-slate-600">
                      {t("workspace.surveys.edit.flow.set_to_formula")}
                    </div>
                    <div className="col-span-12 mt-2">
                      <SetValueFormula
                        id={`action-${idx}-formula`}
                        localSurvey={localSurvey}
                        variableId={action.variableId}
                        expression={action.value.value}
                        scopeBlockIdx={scopeBlockIdx}
                        onExpressionChange={(expression) =>
                          handleValuesChange(idx, {
                            operator: "assign",
                            value: { type: "expression", value: expression },
                          })
                        }
                      />
                    </div>
                  </>
                )}

                {action.objective === "calculate" && action.value.type !== "expression" && (
                  <>
                    <div className="col-span-3">
                      <InputCombobox
                        id={`action-${idx}-variableId`}
                        key={`variableId-${action.id}`}
                        showSearch={false}
                        options={getActionVariableOptions(localSurvey)}
                        value={action.variableId}
                        onChangeValue={(val: string | number | string[]) => {
                          handleValuesChange(idx, {
                            variableId: String(val),
                            value: {
                              type: "static",
                              value: "",
                            },
                          });
                        }}
                        comboboxClasses="grow"
                        emptyDropdownText={t("workspace.surveys.edit.add_a_variable_to_calculate")}
                      />
                    </div>

                    <div className="col-span-3">
                      <InputCombobox
                        id={`action-${idx}-operator`}
                        key={`operator-${action.id}`}
                        showSearch={false}
                        options={[
                          ...getActionOperatorOptions(t, getCalculateFieldType(action.variableId)),
                          // ENG-6935: any calculation can become a formula.
                          { label: t("workspace.surveys.edit.flow.use_a_formula"), value: USE_FORMULA },
                        ]}
                        value={action.operator}
                        onChangeValue={(val: string | number | string[]) => {
                          if (val === USE_FORMULA) {
                            handleValuesChange(idx, {
                              operator: "assign",
                              value: { type: "expression", value: oneStepToFormula(action) },
                            });
                            return;
                          }
                          handleValuesChange(idx, {
                            operator: val as
                              | TActionTextVariableCalculateOperator
                              | TActionNumberVariableCalculateOperator,
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
                          type: getCalculateFieldType(action.variableId) ?? "text",
                        }}
                        groupedOptions={getActionValueOptions(
                          action.variableId,
                          localSurvey,
                          scopeBlockIdx,
                          t
                        )}
                        onChangeValue={(val, option, fromInput) => {
                          const fieldType = option?.meta?.type as
                            | "static"
                            | "variable"
                            | "hiddenField"
                            | "element";

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
                    className="flex size-10 items-center justify-center rounded-md bg-white">
                    <EllipsisVerticalIcon className="size-4 text-slate-700 hover:text-slate-950" />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent>
                  <DropdownMenuItem
                    onClick={() => {
                      handleActionsChange("addBelow", idx);
                    }}
                    icon={<PlusIcon className="size-4" />}>
                    {t("workspace.surveys.edit.add_action_below")}
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    disabled={actions.length === 1}
                    onClick={() => {
                      handleActionsChange("remove", idx);
                    }}
                    icon={<TrashIcon className="size-4" />}>
                    {t("common.remove")}
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => {
                      handleActionsChange("duplicate", idx);
                    }}
                    icon={<CopyIcon className="size-4" />}>
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
