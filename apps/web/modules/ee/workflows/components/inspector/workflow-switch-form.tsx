"use client";

import { useStore } from "jotai";
import { MoreVerticalIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { MAX_SWITCH_CASE_NAME_LENGTH, type TWorkflowSwitchNode } from "@formbricks/workflows";
import { WorkflowStepNameField } from "@/modules/ee/workflows/components/inspector/workflow-step-name-field";
import { useWorkflowVariableGroups } from "@/modules/ee/workflows/hooks/use-workflow-variable-groups";
import {
  getConditionOperatorOptions,
  getTypeHintLookup,
  isListOperator,
  isPresenceOperator,
  toGenericRight,
  toVariableComboboxGroups,
} from "@/modules/ee/workflows/lib/if-else-conditions";
import {
  addSwitchCase,
  applySwitchCaseEdit,
  canAddSwitchCase,
  canRemoveSwitchCase,
  removeSwitchCase,
} from "@/modules/ee/workflows/lib/switch-cases";
import { getVariableDisplayName } from "@/modules/ee/workflows/lib/variable-name";
import { WORKFLOW_STEP_VARIABLE_PROVIDERS } from "@/modules/ee/workflows/lib/variable-picker";
import { countStepsOnSwitchCase } from "@/modules/ee/workflows/lib/workflow-steps";
import { workflowDefinitionAtom } from "@/modules/ee/workflows/state/editor";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { Input } from "@/modules/ui/components/input";
import { InputCombobox } from "@/modules/ui/components/input-combo-box";
import { Label } from "@/modules/ui/components/label";

interface WorkflowSwitchFormProps {
  node: TWorkflowSwitchNode;
  isEditable: boolean;
  onChange: (next: TWorkflowSwitchNode) => void;
}

/**
 * The Switch panel (ENG-7157, mock screen 10): the Variable it compares, then one row per case (name,
 * operator, value) with the If/else operators, up to 10. Default is fixed: it is where a run goes when
 * no case matches. Removing a case whose branch has steps asks first, since the steps go with it.
 */
export const WorkflowSwitchForm = ({ node, isEditable, onChange }: Readonly<WorkflowSwitchFormProps>) => {
  const { t } = useTranslation();
  const store = useStore();
  const groups = useWorkflowVariableGroups(node.id);
  const typeHintOf = useMemo(() => getTypeHintLookup(groups), [groups]);
  const [pendingRemoval, setPendingRemoval] = useState<{ caseId: string; stepCount: number } | null>(null);
  const { left, cases } = node.config;

  const update = (next: TWorkflowSwitchNode) => {
    if (isEditable) onChange(next);
  };

  const variableOptions = useMemo(() => {
    const options = toVariableComboboxGroups(groups, t, (stepGroup) => {
      const typeLabel = WORKFLOW_STEP_VARIABLE_PROVIDERS[stepGroup.stepType].getTypeLabel(t);
      return stepGroup.stepLabel ? `${typeLabel} · ${stepGroup.stepLabel}` : typeLabel;
    });
    // A Variable the groups no longer offer (the sample changed, a step went away) stays listed, so
    // the Switch still says what it compares.
    const offered = new Set(options.flatMap((option) => option.options.map((item) => item.value)));
    if (offered.has(left.path)) return options;
    return [
      ...options,
      {
        label: t("workspace.workflows.variable_group_unavailable"),
        value: "unavailable",
        options: [{ label: getVariableDisplayName(left.path), value: left.path, meta: { type: "variable" } }],
      },
    ];
  }, [groups, left.path, t]);

  const operatorOptions = getConditionOperatorOptions(typeHintOf(left.path), t);

  const requestRemoval = (caseId: string) => {
    const definition = store.get(workflowDefinitionAtom);
    const stepCount = definition ? countStepsOnSwitchCase(definition, node.id, caseId) : 0;
    if (stepCount === 0) update(removeSwitchCase(node, caseId));
    else setPendingRemoval({ caseId, stepCount });
  };

  return (
    <div className="flex flex-col gap-4">
      <WorkflowStepNameField node={node} isEditable={isEditable} onChange={onChange} />
      <div className="flex flex-col gap-2">
        <Label>{t("workspace.workflows.switch_compare")}</Label>
        <InputCombobox
          id={`switch-${node.id}-variable`}
          aria-label={t("workspace.workflows.switch_compare")}
          showSearch
          searchPlaceholder={t("workspace.workflows.variable_picker_search")}
          groupedOptions={variableOptions}
          value={left.path}
          disabled={!isEditable}
          onChangeValue={(value) =>
            update({ ...node, config: { ...node.config, left: { path: String(value) } } })
          }
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>{t("workspace.workflows.switch_cases")}</Label>
        {cases.map((switchCase, index) => {
          const fallbackName = t("workspace.workflows.switch_case_name_default", { number: index + 1 });
          const valueLabel = t("workspace.workflows.switch_case_value", {
            name: switchCase.name || fallbackName,
          });
          const right = toGenericRight(switchCase.right);
          const menu = isEditable ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-10 shrink-0"
                  aria-label={t("workspace.workflows.switch_case_actions", {
                    name: switchCase.name || fallbackName,
                  })}>
                  <MoreVerticalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={!canRemoveSwitchCase(node)}
                  onClick={() => requestRemoval(switchCase.id)}
                  icon={<Trash2Icon className="size-4" />}>
                  {t("workspace.workflows.switch_remove_case")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null;
          return (
            // Two lines per case so each field keeps a usable width in the panel: the name with its
            // menu, then the operator and the value.
            <div key={switchCase.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-2">
              <div className="flex items-center gap-2">
                <Input
                  aria-label={t("workspace.workflows.switch_case_name")}
                  className="min-w-0 flex-1"
                  value={switchCase.name}
                  maxLength={MAX_SWITCH_CASE_NAME_LENGTH}
                  placeholder={fallbackName}
                  disabled={!isEditable}
                  onChange={(event) =>
                    update({
                      ...node,
                      config: {
                        ...node.config,
                        cases: cases.map((item) =>
                          item.id === switchCase.id ? { ...item, name: event.target.value.trimStart() } : item
                        ),
                      },
                    })
                  }
                />
                {menu}
              </div>
              <div className="flex items-start gap-2">
                <div className="w-36 shrink-0">
                  <InputCombobox
                    id={`switch-${node.id}-case-${switchCase.id}-operator`}
                    aria-label={t("workspace.workflows.switch_case_operator", {
                      name: switchCase.name || fallbackName,
                    })}
                    showSearch={false}
                    options={operatorOptions}
                    value={switchCase.operator}
                    disabled={!isEditable}
                    onChangeValue={(value) =>
                      // The value carries over, re-read for the new operator (a list splits, a
                      // presence check drops it), so the draft keeps saving.
                      update(
                        applySwitchCaseEdit(node, switchCase.id, { operator: String(value) }, typeHintOf)
                      )
                    }
                  />
                </div>
                <div className="min-w-0 flex-1">
                  {isListOperator(switchCase.operator) ? (
                    <Input
                      key={`${switchCase.id}-${switchCase.operator}`}
                      aria-label={valueLabel}
                      placeholder={t("workspace.workflows.if_else_values_placeholder")}
                      disabled={!isEditable}
                      defaultValue={
                        Array.isArray(right?.value) ? right.value.join(", ") : (right?.value ?? "").toString()
                      }
                      onBlur={(event) =>
                        update(
                          applySwitchCaseEdit(
                            node,
                            switchCase.id,
                            { rightOperand: { value: event.target.value, type: "static" } },
                            typeHintOf
                          )
                        )
                      }
                    />
                  ) : null}
                  {!isListOperator(switchCase.operator) && !isPresenceOperator(switchCase.operator) ? (
                    <InputCombobox
                      id={`switch-${node.id}-case-${switchCase.id}-value`}
                      aria-label={valueLabel}
                      withInput
                      showSearch={false}
                      inputProps={{ placeholder: t("workspace.surveys.edit.select_or_type_value") }}
                      groupedOptions={variableOptions}
                      value={right?.value ?? ""}
                      disabled={!isEditable}
                      onChangeValue={(value, option) =>
                        update(
                          applySwitchCaseEdit(
                            node,
                            switchCase.id,
                            { rightOperand: { value, type: option?.meta?.type ?? "static" } },
                            typeHintOf
                          )
                        )
                      }
                    />
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
        {isEditable ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-fit"
            disabled={!canAddSwitchCase(node)}
            onClick={() =>
              update(
                addSwitchCase(
                  node,
                  t("workspace.workflows.switch_case_name_default", { number: cases.length + 1 })
                )
              )
            }>
            <PlusIcon />
            {t("workspace.workflows.switch_add_case")}
          </Button>
        ) : null}
      </div>
      {/* Default size: the small alert cuts its text to one line. */}
      <Alert variant="info">
        <AlertDescription>{t("workspace.workflows.switch_hint")}</AlertDescription>
      </Alert>
      <ConfirmationModal
        open={pendingRemoval !== null}
        setOpen={(open) => {
          if (!open) setPendingRemoval(null);
        }}
        title={t("workspace.workflows.switch_remove_case_title")}
        body={t("workspace.workflows.switch_remove_case_body", { count: pendingRemoval?.stepCount ?? 0 })}
        buttonText={t("workspace.workflows.switch_remove_case")}
        buttonVariant="destructive"
        onConfirm={() => {
          if (pendingRemoval) update(removeSwitchCase(node, pendingRemoval.caseId));
          setPendingRemoval(null);
        }}
        Icon={Trash2Icon}
      />
    </div>
  );
};
