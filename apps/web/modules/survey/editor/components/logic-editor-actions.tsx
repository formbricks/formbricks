"use client";

import { createId } from "@paralleldrive/cuid2";
import { CopyIcon, CornerDownRightIcon, EllipsisVerticalIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getComputedEmbeddedFields } from "@formbricks/types/embedded-data-resolver";
import { TSurveyBlockLogicAction, TSurveyBlockLogicActionObjective } from "@formbricks/types/surveys/blocks";
import {
  TActionNumberVariableCalculateOperator,
  TActionTextVariableCalculateOperator,
} from "@formbricks/types/surveys/logic";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getUpdatedActionBody } from "@/lib/surveyLogic/utils";
import { CalculatedFieldPicker } from "@/modules/survey/editor/components/calculated-field-picker";
import { SetValueFormula } from "@/modules/survey/editor/components/set-value-formula";
import { formulaToOneStep, oneStepToFormula } from "@/modules/survey/editor/lib/expression-formula";
import { getNextActionObjective, getObjectivesForAction } from "@/modules/survey/editor/lib/rule-list";
import {
  getActionObjectiveOptions,
  getActionOperatorOptions,
  getActionTargetOptions,
  getActionValueOptions,
  getActionVariableOptions,
} from "@/modules/survey/editor/lib/utils";
import { Button } from "@/modules/ui/components/button";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { InputCombobox } from "@/modules/ui/components/input-combo-box";
import { Label } from "@/modules/ui/components/label";
import { Switch } from "@/modules/ui/components/switch";
import { cn } from "@/modules/ui/lib/utils";

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
  /** The rule has no condition: it runs for everyone, so it only sets values or marks Low quality. */
  readonly alwaysRuns?: boolean;
  /** Opens the Embedded Data card to add a Calculated field, from Set value's empty field picker. */
  readonly onAddCalculatedField?: () => void;
}

/** A Set value action written as a formula (ENG-6935), shown with the formula box. */
const isFormulaAction = (action: TSurveyBlockLogicAction) =>
  action.objective === "calculate" && action.value.type === "expression";

export function LogicEditorActions({
  localSurvey,
  actions,
  onActionsChange,
  scopeBlockIdx,
  isLast,
  alwaysRuns = false,
  onAddCalculatedField,
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
              getNextActionObjective(actionsClone, scopeBlockIdx, { alwaysRuns })
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

  // The formula toggle (UX review #15, #16). On: the one-step calculation as the formula that
  // computes the same thing. Off: back to one step when the formula is one, else after a confirm.
  const [formulaToClearIdx, setFormulaToClearIdx] = useState<number | null>(null);

  const turnFormulaOn = (actionIdx: number) => {
    const action = actions[actionIdx];
    if (action?.objective !== "calculate" || action.value.type === "expression") return;
    const formula = oneStepToFormula({
      variableId: action.variableId,
      operator: action.operator,
      value: action.value,
    });
    handleValuesChange(actionIdx, { operator: "assign", value: { type: "expression", value: formula } });
  };

  const turnFormulaOff = (actionIdx: number) => {
    const action = actions[actionIdx];
    if (action?.objective !== "calculate" || action.value.type !== "expression") return;
    const oneStep = formulaToOneStep(action.value.value, action.variableId);
    const fieldType = getCalculateFieldType(action.variableId);
    // Without a field there is no operator list to fit yet.
    const fitsField =
      fieldType === undefined ||
      getActionOperatorOptions(t, fieldType).some((option) => option.value === oneStep?.operator);
    if (oneStep && fitsField) {
      handleValuesChange(actionIdx, oneStep as Partial<TSurveyBlockLogicAction>);
      return;
    }
    setFormulaToClearIdx(actionIdx);
  };

  const clearFormula = (actionIdx: number) =>
    handleValuesChange(actionIdx, { operator: "assign", value: { type: "static", value: "" } });

  // Before the first question a rule may only jump or set a value (ENG-6932); a rule jumps once and
  // marks Low quality once (ENG-6933).
  const objectiveOptions = getActionObjectiveOptions(t);
  const getObjectiveOptions = (actionIdx: number) => {
    const allowed = new Set<string>(
      getObjectivesForAction(actions, actionIdx, scopeBlockIdx, { alwaysRuns })
    );
    return objectiveOptions.filter((option) => allowed.has(String(option.value)));
  };

  /** An action's ⋮ menu. A formula action shows it beside the formula's @ button, on the box's top line. */
  const renderActionMenu = (idx: number) => (
    <DropdownMenu>
      <DropdownMenuTrigger id={`actions-${idx}-dropdown`} asChild>
        <Button variant="outline" className="flex size-10 items-center justify-center rounded-md bg-white">
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
  );

  return (
    <div className="flex grow flex-col gap-2">
      <div className={cn("flex grow flex-col gap-y-2 last:pb-3", isLast && "border-b border-slate-200")}>
        {actions?.map((action, idx) => (
          <div className="flex items-start gap-x-2" key={action.id}>
            {/* "Then" on the first action's line, as "When" on the first condition's, so the row reads
                "Then Set value …"; an arrow before each action after it. Top-aligned: a formula action
                is taller than one line, and its lead and controls start on its first line. */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-end font-medium text-slate-900">
              {idx === 0 ? (
                t("workspace.surveys.edit.then")
              ) : (
                <CornerDownRightIcon className="size-4 shrink-0 text-slate-500" />
              )}
            </div>
            <div key={action.id} className="flex grow items-start justify-between gap-x-2">
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

                {action.objective === "calculate" && (
                  <>
                    {/* Reads as a sentence: Set value [field] to the expression below, or [field] [operator]
                        [value] for one step. The toggle switches between the two, both ways. */}
                    <div className="col-span-9 flex min-w-0 flex-wrap items-center gap-2">
                      {/* The field takes the width its name needs, up to the row's. */}
                      <div className="max-w-full min-w-0">
                        <CalculatedFieldPicker
                          id={`action-${idx}-variableId`}
                          key={`variableId-${action.id}`}
                          options={getActionVariableOptions(localSurvey)}
                          value={action.variableId}
                          onChange={(variableId) =>
                            handleValuesChange(
                              idx,
                              // A formula stays: a field of another type shows what no longer fits.
                              isFormulaAction(action)
                                ? { variableId }
                                : { variableId, value: { type: "static", value: "" } }
                            )
                          }
                          onAddCalculatedField={onAddCalculatedField}
                        />
                      </div>

                      {action.value.type === "expression" ? (
                        <span className="shrink-0 text-sm whitespace-nowrap text-slate-600">
                          {t("workspace.surveys.edit.flow.set_to_formula")}
                        </span>
                      ) : (
                        <>
                          <div className="w-36 shrink-0">
                            <InputCombobox
                              id={`action-${idx}-operator`}
                              key={`operator-${action.id}`}
                              showSearch={false}
                              options={getActionOperatorOptions(t, getCalculateFieldType(action.variableId))}
                              value={action.operator}
                              onChangeValue={(val: string | number | string[]) => {
                                handleValuesChange(idx, {
                                  operator: val as
                                    | TActionTextVariableCalculateOperator
                                    | TActionNumberVariableCalculateOperator,
                                });
                              }}
                              comboboxClasses="grow"
                            />
                          </div>

                          <div className="min-w-32 flex-1">
                            <InputCombobox
                              id={`action-${idx}-value`}
                              key={`value-${action.id}`}
                              withInput={true}
                              clearable={true}
                              value={action.value?.value ?? ""}
                              inputProps={{
                                placeholder: t("workspace.surveys.edit.flow.value_placeholder"),
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

                      <div className="ml-auto flex shrink-0 items-center gap-2">
                        <Switch
                          id={`action-${idx}-formula-toggle`}
                          checked={action.value.type === "expression"}
                          onCheckedChange={(on) => (on ? turnFormulaOn(idx) : turnFormulaOff(idx))}
                        />
                        <Label
                          htmlFor={`action-${idx}-formula-toggle`}
                          className="text-sm font-normal text-slate-600">
                          {t("workspace.surveys.edit.flow.formula")}
                        </Label>
                      </div>
                    </div>

                    {action.value.type === "expression" && (
                      <div className="col-span-12 mt-2">
                        <SetValueFormula
                          id={`action-${idx}-formula`}
                          localSurvey={localSurvey}
                          variableId={action.variableId}
                          expression={action.value.value}
                          scopeBlockIdx={scopeBlockIdx}
                          actionMenu={renderActionMenu(idx)}
                          onExpressionChange={(expression) =>
                            handleValuesChange(idx, {
                              operator: "assign",
                              value: { type: "expression", value: expression },
                            })
                          }
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
              {!isFormulaAction(action) && renderActionMenu(idx)}
            </div>
          </div>
        ))}
      </div>

      <ConfirmationModal
        open={formulaToClearIdx !== null}
        setOpen={(open) => {
          if (!open) setFormulaToClearIdx(null);
        }}
        title={t("workspace.surveys.edit.flow.turn_formula_off_title")}
        body={t("workspace.surveys.edit.flow.turn_formula_off_body")}
        buttonText={t("workspace.surveys.edit.flow.turn_formula_off_confirm")}
        onConfirm={() => {
          if (formulaToClearIdx !== null) clearFormula(formulaToClearIdx);
          setFormulaToClearIdx(null);
        }}
      />
    </div>
  );
}
