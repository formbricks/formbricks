"use client";

import { PlusIcon } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  type TWorkflowConditionGroup,
  type TWorkflowFilterNode,
  type TWorkflowIfElseNode,
  flattenWorkflowConditions,
} from "@formbricks/workflows";
import { InspectorCard } from "@/modules/ee/workflows/components/inspector/inspector-card";
import { WorkflowStepNameField } from "@/modules/ee/workflows/components/inspector/workflow-step-name-field";
import { useBoundTriggerSurvey } from "@/modules/ee/workflows/hooks/use-bound-trigger-survey";
import { useWorkflowVariableGroups } from "@/modules/ee/workflows/hooks/use-workflow-variable-groups";
import {
  getChoiceQuestion,
  getChoiceValueOptions,
  isTypedValue,
} from "@/modules/ee/workflows/lib/choice-conditions";
import {
  addConditionBelowInGroup,
  applyConditionEdit,
  canAddCondition,
  createConditionLike,
  duplicateConditionInGroup,
  getTypeHintLookup,
  isListOperator,
  isPresenceOperator,
  removeConditionFromGroup,
  toGenericConditionGroup,
  toVariableComboboxGroups,
  toggleConnectorInGroup,
  updateConditionInGroup,
  withSurveyOperatorNames,
} from "@/modules/ee/workflows/lib/if-else-conditions";
import { getVariableOperatorOptions } from "@/modules/ee/workflows/lib/survey-condition-operators";
import { getVariableDisplayName } from "@/modules/ee/workflows/lib/variable-name";
import { WORKFLOW_STEP_VARIABLE_PROVIDERS } from "@/modules/ee/workflows/lib/variable-picker";
import { Button } from "@/modules/ui/components/button";
import { ConditionsEditor } from "@/modules/ui/components/conditions-editor";
import type {
  TConditionsEditorCallbacks,
  TConditionsEditorConfig,
} from "@/modules/ui/components/conditions-editor/types";
import { Input } from "@/modules/ui/components/input";

type TConditionStepNode = TWorkflowIfElseNode | TWorkflowFilterNode;

interface ConditionStepFormProps<TNode extends TConditionStepNode> {
  node: TNode;
  isEditable: boolean;
  onChange: (next: TNode) => void;
  /** The card's question ("Run “Then” when", "Continue when") and what happens otherwise. */
  title: string;
  footer: string;
}

/**
 * The If/else and Filter panels (ED8, mock screen 3; ADR 0056): the kit ConditionsEditor with survey
 * operator names, its Variables from the Variable picker's groups (payload, earlier steps, survey
 * answers). Only the card's question and its footer differ.
 */
const ConditionStepForm = <TNode extends TConditionStepNode>({
  node,
  isEditable,
  onChange,
  title,
  footer,
}: Readonly<ConditionStepFormProps<TNode>>) => {
  const { t } = useTranslation();
  const groups = useWorkflowVariableGroups(node.id);
  const group = node.config.condition;
  const typeHintOf = useMemo(() => getTypeHintLookup(groups), [groups]);
  const survey = useBoundTriggerSurvey();

  const setGroup = (next: TWorkflowConditionGroup) => {
    if (!isEditable) return;
    onChange({ ...node, config: { ...node.config, condition: withSurveyOperatorNames(next) } });
  };

  const leftOptions = useMemo(() => {
    const options = toVariableComboboxGroups(groups, t, (stepGroup) => {
      const typeLabel = WORKFLOW_STEP_VARIABLE_PROVIDERS[stepGroup.stepType].getTypeLabel(t);
      return stepGroup.stepLabel ? `${typeLabel} · ${stepGroup.stepLabel}` : typeLabel;
    });
    // A Variable the groups no longer offer (the sample changed, a step went away) stays listed, so
    // the condition still says what it compares.
    const offered = new Set(options.flatMap((option) => option.options.map((item) => item.value)));
    const missing = [
      ...new Set(flattenWorkflowConditions(group).map((condition) => condition.left.path)),
    ].filter((path) => !offered.has(path));
    if (missing.length === 0) return options;
    return [
      ...options,
      {
        label: t("workspace.workflows.variable_group_unavailable"),
        value: "unavailable",
        options: missing.map((path) => ({
          label: getVariableDisplayName(path),
          value: path,
          meta: { type: "variable" },
        })),
      },
    ];
  }, [groups, group, t]);

  const config: TConditionsEditorConfig = {
    getLeftOperandOptions: () => leftOptions,
    getOperatorOptions: (condition) =>
      getVariableOperatorOptions({
        path: String(condition.leftOperand.value),
        operator: condition.operator,
        survey,
        typeHint: typeHintOf(condition.leftOperand.value),
        t,
      }),
    getValueProps: (condition) => {
      // A choice question offers its choices, stored by id (DC11), as the survey flow editor does.
      // A label typed before then stays visible and editable until a choice is picked.
      const question = getChoiceQuestion(String(condition.leftOperand.value), survey);
      if (question) {
        return {
          show: !isPresenceOperator(condition.operator),
          showInput: isTypedValue(condition.rightOperand),
          options: getChoiceValueOptions(question, condition.operator, t),
        };
      }
      return {
        show: !isPresenceOperator(condition.operator),
        showInput: true,
        inputType: "text",
        options: leftOptions,
      };
    },
    getDefaultOperator: () => "equals",
    formatLeftOperandValue: (condition) => condition.leftOperand.value,
    // A list operator compares against several typed values: one comma-separated field. A choice
    // question's list operators pick several choices instead.
    renderValueInput: (condition) => {
      if (!isListOperator(condition.operator)) return undefined;
      if (getChoiceQuestion(String(condition.leftOperand.value), survey)) return undefined;
      const value = condition.rightOperand?.value;
      return (
        <Input
          key={`${condition.id}-${condition.operator}`}
          aria-label={t("workspace.workflows.if_else_values_label")}
          placeholder={t("workspace.workflows.if_else_values_placeholder")}
          disabled={!isEditable}
          defaultValue={Array.isArray(value) ? value.join(", ") : (value ?? "").toString()}
          onBlur={(event) =>
            callbacks.onUpdateCondition(condition.id, {
              rightOperand: { value: event.target.value, type: "static" },
            })
          }
        />
      );
    },
    leftOperandPlaceholder: t("workspace.workflows.variable_picker_search"),
  };

  const callbacks: TConditionsEditorCallbacks = {
    onAddConditionBelow: (conditionId) => {
      if (!canAddCondition(group)) return;
      const anchor = flattenWorkflowConditions(group).find((condition) => condition.id === conditionId);
      const last = flattenWorkflowConditions(group).at(-1);
      const base = anchor ?? last;
      if (!base) return;
      setGroup(addConditionBelowInGroup(group, conditionId, createConditionLike(base)));
    },
    onRemoveCondition: (conditionId) => setGroup(removeConditionFromGroup(group, conditionId)),
    onDuplicateCondition: (conditionId) => {
      if (!canAddCondition(group)) return;
      setGroup(duplicateConditionInGroup(group, conditionId));
    },
    onUpdateCondition: (conditionId, updates) =>
      setGroup(
        updateConditionInGroup(group, conditionId, (condition) =>
          applyConditionEdit(condition, updates, typeHintOf)
        )
      ),
    onToggleGroupConnector: (groupId) => setGroup(toggleConnectorInGroup(group, groupId)),
  };

  const lastCondition = flattenWorkflowConditions(group).at(-1);

  return (
    <div className="flex flex-col gap-4">
      <WorkflowStepNameField node={node} isEditable={isEditable} onChange={onChange} />
      {/* One card for the one question this step asks: when does "Then" run. What happens otherwise is
          its footer, next to the conditions it depends on, instead of a separate blue alert. */}
      <InspectorCard title={title} footer={footer}>
        {/* Inert for a read-only member or a live workflow: the editor has no disabled mode. */}
        <fieldset
          disabled={!isEditable}
          className={isEditable ? undefined : "pointer-events-none opacity-70"}>
          <ConditionsEditor
            conditions={toGenericConditionGroup(group)}
            config={config}
            callbacks={callbacks}
          />
        </fieldset>
        {isEditable && lastCondition ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-fit"
            disabled={!canAddCondition(group)}
            onClick={() => callbacks.onAddConditionBelow(lastCondition.id)}>
            <PlusIcon />
            {t("workspace.workflows.if_else_add_condition")}
          </Button>
        ) : null}
      </InspectorCard>
    </div>
  );
};

type TStepFormProps<TNode extends TConditionStepNode> = Omit<
  ConditionStepFormProps<TNode>,
  "title" | "footer"
>;

/** Runs that do not match take the Else branch. */
export const WorkflowIfElseForm = (props: Readonly<TStepFormProps<TWorkflowIfElseNode>>) => {
  const { t } = useTranslation();
  return (
    <ConditionStepForm
      {...props}
      title={t("workspace.workflows.if_else_run_then_when")}
      footer={t("workspace.workflows.if_else_else_hint")}
    />
  );
};

/** Runs that do not match end at the Filter (ADR 0056). */
export const WorkflowFilterForm = (props: Readonly<TStepFormProps<TWorkflowFilterNode>>) => {
  const { t } = useTranslation();
  return (
    <ConditionStepForm
      {...props}
      title={t("workspace.workflows.filter_continue_when")}
      footer={t("workspace.workflows.filter_end_hint")}
    />
  );
};
