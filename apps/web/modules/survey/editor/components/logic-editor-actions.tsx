"use client";

import { createId } from "@paralleldrive/cuid2";
import { CopyIcon, CornerDownRightIcon, EllipsisVerticalIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getComputedEmbeddedFields } from "@formbricks/types/embedded-data-resolver";
import { TSurveyBlockLogicAction, TSurveyBlockLogicActionObjective } from "@formbricks/types/surveys/blocks";
import type { TExpression } from "@formbricks/types/surveys/expressions";
import {
  TActionNumberVariableCalculateOperator,
  TActionTextVariableCalculateOperator,
} from "@formbricks/types/surveys/logic";
import { TSurvey } from "@formbricks/types/surveys/types";
import { createEmptyFormulaAction, getUpdatedActionBody } from "@/lib/surveyLogic/utils";
import { CalculatedFieldPicker } from "@/modules/survey/editor/components/calculated-field-picker";
import { SetValueFormula } from "@/modules/survey/editor/components/set-value-formula";
import { formulaToOneStep, oneStepToFormula } from "@/modules/survey/editor/lib/expression-formula";
import { isOneStepDateExpression } from "@/modules/survey/editor/lib/fixed-date-expression";
import { getNextActionObjective, getObjectivesForAction } from "@/modules/survey/editor/lib/rule-list";
import { TARGET_LIST_CLASS, getJumpTargetGroups } from "@/modules/survey/editor/lib/target-options";
import {
  getActionObjectiveOptions,
  getActionOperatorOptions,
  getActionTargetOptions,
  getActionValueOptions,
  getActionVariableOptions,
  isComputedDateField,
} from "@/modules/survey/editor/lib/utils";
import { Button } from "@/modules/ui/components/button";
import {
  SENTENCE_FIELDS_CLASS,
  SENTENCE_ICON_BUTTON_CLASS,
  SENTENCE_LEAD_CLASS,
  SENTENCE_ROW_ACTIONS_CLASS,
  SENTENCE_ROW_CLASS,
} from "@/modules/ui/components/conditions-editor/lib/sentence";
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
  /** The rule has no condition: it runs for everyone, so it only sets values or marks Low quality. */
  readonly alwaysRuns?: boolean;
  /** Opens the Embedded Data card to add a Calculated field, from Set value's empty field picker. */
  readonly onAddCalculatedField?: () => void;
}

/** What a date field's one-step row shows: the day, or the answer or field it copies. */
const getOneStepDateValue = (expression: TExpression): string | number =>
  expression.type === "call" ? "" : expression.value;

export function LogicEditorActions({
  localSurvey,
  actions,
  onActionsChange,
  scopeBlockIdx,
  alwaysRuns = false,
  onAddCalculatedField,
}: LogicEditorActionsProps) {
  const { t } = useTranslation();

  /**
   * ENG-1837: which input widget a calculate action gets is driven by the computed field's declared
   * type. ENG-2628: read off the survey's rows, which the Embedded Data card edits directly, so a
   * retype still reaches this widget on the next render.
   */
  const getCalculateFieldType = (storageKey: string): "text" | "number" | "date" | undefined => {
    const dataType = getComputedEmbeddedFields(localSurvey).find(({ link }) => link.storageKey === storageKey)
      ?.field.dataType;
    if (dataType === undefined) return undefined;
    if (dataType === "date") return "date";
    return dataType === "number" ? "number" : "text";
  };

  // A date field's Set value is stored as an expression either way (P38), so the switch can't be read
  // off the stored type: the row is one step while the expression is one (a day, an answer, a field),
  // and these actions were switched to the expression box by hand.
  const [dateFormulaActionIds, setDateFormulaActionIds] = useState<ReadonlySet<string>>(new Set());
  const setDateFormulaMode = (actionId: string, on: boolean) =>
    setDateFormulaActionIds((current) => {
      const next = new Set(current);
      if (on) next.add(actionId);
      else next.delete(actionId);
      return next;
    });

  /** A date field's one-step row: "Set [date field] to [a day, a date answer or a date field]". */
  const isDateOneStep = (action: TSurveyBlockLogicAction) =>
    action.objective === "calculate" &&
    action.value.type === "expression" &&
    isComputedDateField(localSurvey, action.variableId) &&
    !dateFormulaActionIds.has(action.id) &&
    isOneStepDateExpression(action.value.value);

  /** A Set value action shown with the expression box (ENG-6935). */
  const isFormulaAction = (action: TSurveyBlockLogicAction) =>
    action.objective === "calculate" && action.value.type === "expression" && !isDateOneStep(action);

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
    if (action === undefined) return;
    // Already an expression: the box opens on it as it is.
    if (isDateOneStep(action)) {
      setDateFormulaMode(action.id, true);
      return;
    }
    if (action.objective !== "calculate" || action.value.type === "expression") return;
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
    if (isComputedDateField(localSurvey, action.variableId)) {
      if (isOneStepDateExpression(action.value.value)) setDateFormulaMode(action.id, false);
      else setFormulaToClearIdx(actionIdx);
      return;
    }
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

  const clearFormula = (actionIdx: number) => {
    const action = actions[actionIdx];
    if (action?.objective === "calculate" && isComputedDateField(localSurvey, action.variableId)) {
      setDateFormulaMode(action.id, false);
      handleValuesChange(actionIdx, { ...createEmptyFormulaAction(action.id, action.variableId) });
      return;
    }
    handleValuesChange(actionIdx, { operator: "assign", value: { type: "static", value: "" } });
  };

  // Picking the field a Set value step writes. A formula stays: a field of another type shows what no
  // longer fits. One step starts over, and a date field's one step is stored as an expression (P38).
  const changeCalculatedField = (actionIdx: number, variableId: string) => {
    const action = actions[actionIdx];
    if (isFormulaAction(action)) {
      setDateFormulaMode(action.id, true);
      handleValuesChange(actionIdx, { variableId });
      return;
    }
    setDateFormulaMode(action.id, false);
    if (isComputedDateField(localSurvey, variableId)) {
      handleValuesChange(actionIdx, { ...createEmptyFormulaAction(action.id, variableId) });
      return;
    }
    handleValuesChange(actionIdx, { variableId, value: { type: "static", value: "" } });
  };

  // Before the first question a rule may not require an answer (ENG-6932); a rule jumps once and
  // marks Low quality once (ENG-6933).
  const objectiveOptions = getActionObjectiveOptions(t);
  const getObjectiveOptions = (actionIdx: number) => {
    const allowed = new Set<string>(
      getObjectivesForAction(actions, actionIdx, scopeBlockIdx, { alwaysRuns })
    );
    return objectiveOptions.filter((option) => allowed.has(String(option.value)));
  };

  /** An action's controls at the end of its first line: a borderless delete and a ⋮ menu (ENG-6969 T6). */
  const renderActionControls = (idx: number) => (
    <div className={SENTENCE_ROW_ACTIONS_CLASS}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={SENTENCE_ICON_BUTTON_CLASS}
        aria-label={t("common.remove")}
        disabled={actions.length === 1}
        onClick={() => handleActionsChange("remove", idx)}>
        <TrashIcon />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger id={`actions-${idx}-dropdown`} asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={SENTENCE_ICON_BUTTON_CLASS}
            aria-label={t("common.actions")}>
            <EllipsisVerticalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            onClick={() => handleActionsChange("addBelow", idx)}
            icon={<PlusIcon className="size-4" />}>
            {t("workspace.surveys.edit.add_action_below")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleActionsChange("duplicate", idx)}
            icon={<CopyIcon className="size-4" />}>
            {t("common.duplicate")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    // The conditions' grid (label · field · operator · value · actions), so a rule's conditions and
    // actions line up (ENG-6969 T6). Its own container, as wide as the conditions editor's.
    <div className="@container flex grow flex-col gap-2">
      <div className="flex grow flex-col gap-y-2">
        {actions?.map((action, idx) => (
          <div className={SENTENCE_ROW_CLASS} key={action.id}>
            {/* "Then" on the first action's line, as "If" on the first condition's, so the row reads
                "Then Jump to …"; an arrow before each action after it. Top-aligned: a formula action
                is taller than one line, and its lead and controls start on its first line. */}
            <div className={SENTENCE_LEAD_CLASS}>
              {idx === 0 ? (
                t("workspace.surveys.edit.then")
              ) : (
                <CornerDownRightIcon className="size-4 shrink-0 text-slate-500" />
              )}
            </div>
            {/* The step's kind needs little room ("Set value", "Jump to"), so the rest of the line keeps
                field, operator, value and the Expression switch together (review of ENG-6969). */}
            <div
              className={cn(
                SENTENCE_FIELDS_CLASS,
                "@xl:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_minmax(0,1fr)]"
              )}>
              <div
                // ENG-6933: takes nothing else, so the objective is the whole action.
                className={cn("min-w-0", action.objective === "markLowQuality" && "@xl:col-span-3")}>
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

              {/* The target spans the operator and value columns, so the right edges line up. */}
              {action.objective === "jumpToBlock" && (
                <div className="min-w-0 @xl:col-span-2">
                  <InputCombobox
                    id={`action-${idx}-target`}
                    key={`target-${action.id}`}
                    showSearch={true}
                    searchPlaceholder={t("workspace.surveys.edit.flow.search_blocks_and_endings")}
                    // The destination's icon, as on the row's pill (ENG-6969 T6.5).
                    groupedOptions={getJumpTargetGroups(localSurvey, scopeBlockIdx, t)}
                    iconClassName="size-4 text-slate-500"
                    dropdownClassName={TARGET_LIST_CLASS}
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

              {action.objective === "requireAnswer" && (
                <div className="min-w-0 @xl:col-span-2">
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
                  {/* The Expression switch keeps its place at the end of the first line in both modes; only the
                        sentence before it wraps when the row is narrow. */}
                  <div className="flex min-w-0 items-start gap-2 @xl:col-span-2">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      {/* The field takes the width its name needs, up to the row's. */}
                      <div className="max-w-full min-w-0">
                        <CalculatedFieldPicker
                          id={`action-${idx}-variableId`}
                          key={`variableId-${action.id}`}
                          options={getActionVariableOptions(localSurvey)}
                          value={action.variableId}
                          onChange={(variableId) => changeCalculatedField(idx, variableId)}
                          onAddCalculatedField={onAddCalculatedField}
                        />
                      </div>

                      {isFormulaAction(action) ? (
                        <span className="shrink-0 text-sm whitespace-nowrap text-slate-600">
                          {t("workspace.surveys.edit.flow.set_to_formula")}
                        </span>
                      ) : (
                        <>
                          <div className="w-32 shrink-0">
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

                          <div className="min-w-28 flex-1">
                            <InputCombobox
                              id={`action-${idx}-value`}
                              key={`value-${action.id}`}
                              withInput={true}
                              clearable={true}
                              value={
                                // A date field's one step is the expression's leaf (P38).
                                action.value.type === "expression"
                                  ? getOneStepDateValue(action.value.value)
                                  : (action.value?.value ?? "")
                              }
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

                                if (!fromInput && fieldType === "static") return;
                                if (isDateOneStep(action)) {
                                  // Stored as the expression's leaf (P38).
                                  const leaf: TExpression = {
                                    type: fromInput ? "static" : fieldType,
                                    value: val as string,
                                  };
                                  handleValuesChange(idx, {
                                    operator: "assign",
                                    value: { type: "expression", value: leaf },
                                  });
                                } else if (fromInput) {
                                  handleValuesChange(idx, {
                                    value: { type: "static", value: val as string },
                                  });
                                } else if (fieldType !== "static") {
                                  handleValuesChange(idx, {
                                    value: { type: fieldType, value: val as string },
                                  });
                                }
                              }}
                              comboboxClasses="grow shrink-0"
                            />
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex h-10 shrink-0 items-center gap-2">
                      <Switch
                        id={`action-${idx}-formula-toggle`}
                        checked={isFormulaAction(action)}
                        onCheckedChange={(on) => (on ? turnFormulaOn(idx) : turnFormulaOff(idx))}
                      />
                      <Label
                        htmlFor={`action-${idx}-formula-toggle`}
                        className="text-sm font-normal text-slate-600">
                        {t("workspace.surveys.edit.flow.formula")}
                      </Label>
                    </div>
                  </div>

                  {isFormulaAction(action) && action.value.type === "expression" && (
                    <div className="min-w-0 @xl:col-span-3">
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
                  )}
                </>
              )}
            </div>
            {renderActionControls(idx)}
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
