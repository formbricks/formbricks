"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import { CopyIcon, EllipsisVerticalIcon, PlusIcon, TrashIcon, WorkflowIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { TConnector } from "@formbricks/types/surveys/logic";
import { Button } from "@/modules/ui/components/button";
import {
  type TConditionValue,
  createConditionHandlers,
  isMultiSelectOperator,
} from "@/modules/ui/components/conditions-editor/lib/condition-handlers";
import {
  SENTENCE_FIELDS_CLASS,
  SENTENCE_ICON_BUTTON_CLASS,
  SENTENCE_LEAD_CLASS,
  SENTENCE_ROW_ACTIONS_CLASS,
  SENTENCE_ROW_CLASS,
  getSentenceLead,
  pickConnector,
  withComparisonPills,
} from "@/modules/ui/components/conditions-editor/lib/sentence";
import { isConditionGroup } from "@/modules/ui/components/conditions-editor/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { InputCombobox } from "@/modules/ui/components/input-combo-box";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { ConditionsEditorProps, TGenericCondition, TGenericConditionGroup } from "./types";

/**
 * The conditions editor as a sentence (ENG-6969 T6), `variant="sentence"`: "If [field] [operator]
 * [value]", the and/or picked in a small select before the second condition and repeated as text
 * before the rest, no separate "When [all are true]" row. Each row is the same grid (label · field ·
 * operator · value · actions) as the rule's actions, so their edges line up. A condition whose field
 * is still to be chosen (a show-if draft) reads "Choose a question or field", with its operator and
 * value disabled until one is picked.
 *
 * Used by the survey logic editor and the Flow tab's show-if popovers only; every other caller keeps
 * the default layout.
 */
export function SentenceConditionsEditor({
  conditions,
  config,
  callbacks,
  depth = 0,
  quotaErrors,
  isSubmitted = false,
  isConnectorLocked = false,
}: Readonly<ConditionsEditorProps>) {
  const { t } = useTranslation();
  const [parent] = useAutoAnimate();

  const { handleLeftOperandChange, handleOperatorChange, handleRightOperandChange } = createConditionHandlers(
    config,
    callbacks
  );

  const getConnectorText = (connector: TConnector) =>
    connector === "and" ? t("workspace.surveys.edit.flow.and") : t("workspace.surveys.edit.flow.or");

  const renderLead = (index: number): ReactNode => {
    const lead = getSentenceLead({ index, depth, connector: conditions.connector, isConnectorLocked });
    switch (lead.kind) {
      case "if":
        return t("workspace.surveys.edit.flow.if");
      case "text":
        return getConnectorText(lead.connector);
      case "select":
        return (
          <Select
            value={conditions.connector}
            onValueChange={(picked) =>
              pickConnector(conditions, picked as TConnector, callbacks.onToggleGroupConnector)
            }>
            <SelectTrigger
              className="h-7 w-auto gap-1 bg-white px-2 font-medium text-slate-700"
              aria-label={t("workspace.surveys.edit.flow.connector_label")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="min-w-fit">
              <SelectItem value="and">{getConnectorText("and")}</SelectItem>
              <SelectItem value="or">{getConnectorText("or")}</SelectItem>
            </SelectContent>
          </Select>
        );
      default:
        return null;
    }
  };

  const renderGroup = (group: TGenericConditionGroup, index: number) => (
    <div key={group.id} className={SENTENCE_ROW_CLASS}>
      <div className={SENTENCE_LEAD_CLASS}>{renderLead(index)}</div>
      <div className="min-w-0 rounded-lg border border-slate-200 p-2">
        <SentenceConditionsEditor
          conditions={group}
          config={config}
          callbacks={callbacks}
          depth={depth + 1}
        />
      </div>
      {/* The group keeps its ⋮ menu (the Airtable pattern). */}
      <div className={SENTENCE_ROW_ACTIONS_CLASS}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
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
              onClick={() => callbacks.onAddConditionBelow(group.id)}
              icon={<PlusIcon className="size-4" />}>
              {t("workspace.surveys.edit.add_condition_below")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => callbacks.onRemoveCondition(group.id)}
              icon={<TrashIcon className="size-4" />}>
              {t("common.remove")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  const renderCondition = (condition: TGenericCondition, index: number) => {
    const onCreateGroup = callbacks.onCreateGroup;
    // A show-if draft opens with its field still to be chosen (ENG-6969 T6); nothing is offered after
    // it until one is picked.
    const hasField = condition.leftOperand.value !== "";
    const quotaError =
      quotaErrors?.logic?.conditions?.[index]?.message ||
      quotaErrors?.logic?.conditions?.[index]?.rightOperand?.message;

    let valueInput: ReactNode = null;
    if (hasField) {
      const customValueInput = config.renderValueInput?.(condition);
      const { show = false, options, showInput = false, inputType } = config.getValueProps(condition);
      const allowMultiSelect = isMultiSelectOperator(condition.operator);
      if (customValueInput !== undefined) {
        valueInput = customValueInput;
      } else if (show) {
        valueInput = (
          <InputCombobox
            id={`condition-${depth}-${index}-conditionMatchValue`}
            withInput={showInput}
            inputProps={{
              type: inputType,
              placeholder: t("workspace.surveys.edit.select_or_type_value"),
            }}
            key="conditionMatchValue"
            showSearch={false}
            groupedOptions={options}
            allowMultiSelect={allowMultiSelect}
            showCheckIcon={allowMultiSelect}
            value={
              config.formatRightOperandValue
                ? config.formatRightOperandValue(condition)
                : condition.rightOperand?.value
            }
            clearable={true}
            onChangeValue={(val, option) => handleRightOperandChange(condition, val, option)}
          />
        );
      }
    }

    return (
      <div key={condition.id} className="flex flex-col">
        <div className={SENTENCE_ROW_CLASS}>
          <div className={SENTENCE_LEAD_CLASS}>{renderLead(index)}</div>

          <div className={SENTENCE_FIELDS_CLASS}>
            <InputCombobox
              id={`condition-${depth}-${index}-conditionValue`}
              key="conditionValue"
              showSearch
              searchPlaceholder={t("workspace.surveys.edit.flow.search_questions_and_fields")}
              placeholder={t("workspace.surveys.edit.flow.choose_question_or_field")}
              groupedOptions={config.getLeftOperandOptions()}
              wideDropdown
              iconClassName="size-4 text-slate-500"
              value={hasField ? config.formatLeftOperandValue(condition) : null}
              onChangeValue={(val: TConditionValue, option) => {
                handleLeftOperandChange(condition, String(val), option);
              }}
            />
            <InputCombobox
              id={`condition-${depth}-${index}-conditionOperator`}
              key="conditionOperator"
              showSearch={false}
              options={hasField ? withComparisonPills(config.getOperatorOptions(condition)) : []}
              placeholder={t("workspace.surveys.edit.flow.condition_placeholder")}
              value={hasField ? condition.operator : null}
              disabled={!hasField}
              onChangeValue={(val: TConditionValue) => {
                handleOperatorChange(condition, String(val));
              }}
            />
            {valueInput !== null && <div className="min-w-0">{valueInput}</div>}
          </div>

          <div className={SENTENCE_ROW_ACTIONS_CLASS}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={SENTENCE_ICON_BUTTON_CLASS}
              aria-label={t("common.remove")}
              // Quotas keep their only condition; logic and show-if may remove it.
              disabled={!onCreateGroup && conditions.conditions.length === 1}
              onClick={() => callbacks.onRemoveCondition(condition.id)}>
              <TrashIcon />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger id={`condition-${depth}-${index}-dropdown`} asChild>
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
                  onClick={() => callbacks.onAddConditionBelow(condition.id)}
                  icon={<PlusIcon className="size-4" />}>
                  {t("workspace.surveys.edit.add_condition_below")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => callbacks.onDuplicateCondition(condition.id)}
                  icon={<CopyIcon className="size-4" />}>
                  {t("common.duplicate")}
                </DropdownMenuItem>
                {onCreateGroup && (config.canCreateGroup?.(depth) ?? true) && (
                  <DropdownMenuItem
                    onClick={() => onCreateGroup(condition.id)}
                    icon={<WorkflowIcon className="size-4" />}
                    disabled={conditions.conditions.length <= 1}>
                    {t("workspace.surveys.edit.create_group")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {quotaError && isSubmitted && (
          <p className="mt-2 w-full text-right text-sm text-error">{quotaError}</p>
        )}
      </div>
    );
  };

  return (
    // The container query on the editor's own width: the field, operator and value stack in a narrow
    // editor column and sit side by side when there is room.
    <div ref={parent} className="@container flex flex-col gap-y-2">
      {conditions.conditions.map((condition, index) =>
        isConditionGroup(condition) ? renderGroup(condition, index) : renderCondition(condition, index)
      )}
    </div>
  );
}
