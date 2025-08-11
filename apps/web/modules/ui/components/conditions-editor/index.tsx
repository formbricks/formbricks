"use client";

import { Button } from "@/modules/ui/components/button";
import { isConditionGroup } from "@/modules/ui/components/conditions-editor/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { InputCombobox, TComboboxOption } from "@/modules/ui/components/input-combo-box";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { cn } from "@/modules/ui/lib/utils";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { useTranslate } from "@tolgee/react";
import { CopyIcon, EllipsisVerticalIcon, PlusIcon, TrashIcon, WorkflowIcon } from "lucide-react";
import {
  TConditionsEditorCallbacks,
  TConditionsEditorConfig,
  TGenericCondition,
  TGenericConditionGroup,
} from "./types";

interface ConditionsEditorProps {
  conditions: TGenericConditionGroup;
  config: TConditionsEditorConfig;
  callbacks: TConditionsEditorCallbacks;
  depth?: number;
}

export function ConditionsEditor({ conditions, config, callbacks, depth = 0 }: ConditionsEditorProps) {
  const { t } = useTranslate();
  const [parent] = useAutoAnimate();

  const handleLeftOperandChange = (condition: TGenericCondition, value: string, option?: TComboboxOption) => {
    const type = option?.meta?.type || "static";

    callbacks.onUpdateCondition(condition.id, {
      leftOperand: {
        value,
        type,
        meta: option?.meta,
      },
      operator: config.getDefaultOperator(),
      rightOperand: undefined,
    });
  };

  const handleOperatorChange = (condition: TGenericCondition, value: string) => {
    if (value !== condition.operator) {
      callbacks.onUpdateCondition(condition.id, {
        operator: value,
        rightOperand: undefined,
      });
    }
  };

  const handleRightOperandChange = (
    condition: TGenericCondition,
    value: string | number | string[],
    option?: TComboboxOption
  ) => {
    const type = option?.meta?.type || "static";

    callbacks.onUpdateCondition(condition.id, {
      rightOperand: {
        value,
        type,
      },
    });
  };

  const renderCondition = (
    condition: TGenericCondition | TGenericConditionGroup,
    index: number,
    parentConditionGroup: TGenericConditionGroup
  ) => {
    const connector = parentConditionGroup.connector;

    if (isConditionGroup(condition)) {
      return (
        <div key={condition.id} className="flex items-baseline gap-x-1">
          <div className="w-10 shrink-0 text-right text-sm font-medium text-slate-900">
            {index > 0 ? <div>{connector}</div> : <div />}
          </div>
          <div className="relative flex w-full items-center gap-x-1 rounded-lg border border-slate-400 p-3">
            <div className={cn("flex-1")}>
              <ConditionsEditor
                conditions={condition}
                config={config}
                callbacks={callbacks}
                depth={depth + 1}
              />
            </div>

            {condition.conditions.length > 1 && (
              <div className="absolute right-3 top-3">
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <Button
                      variant="secondary"
                      className="flex h-10 w-10 items-center justify-center rounded-md">
                      <EllipsisVerticalIcon className="h-4 w-4 text-slate-700 hover:text-slate-950" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      onClick={() => {
                        callbacks.onAddConditionBelow(condition.id);
                      }}
                      icon={<PlusIcon className="h-4 w-4" />}>
                      {t("environments.surveys.edit.add_condition_below")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => callbacks.onRemoveCondition(condition.id)}
                      icon={<TrashIcon className="h-4 w-4" />}>
                      {t("common.remove")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </div>
      );
    }

    const leftOperandOptions = config.getLeftOperandOptions();
    const operatorOptions = config.getOperatorOptions(condition);
    const { show = false, options, showInput = false, inputType } = config.getValueProps(condition);

    const allowMultiSelect = [
      "equalsOneOf",
      "includesAllOf",
      "includesOneOf",
      "doesNotIncludeOneOf",
      "doesNotIncludeAllOf",
      "isAnyOf",
    ].includes(condition.operator);

    return (
      <div key={condition.id} className="flex items-center gap-x-2">
        <div className="w-10 shrink-0 text-right text-sm font-medium text-slate-900">
          {index > 0 ? (
            <div>{connector}</div>
          ) : parentConditionGroup.conditions.length === 1 ? (
            <div>When</div>
          ) : (
            <div />
          )}
        </div>

        <div className="grid w-full flex-1 grid-cols-12 gap-x-2">
          <div className="col-span-4">
            <InputCombobox
              id={`condition-${depth}-${index}-conditionValue`}
              key="conditionValue"
              showSearch
              groupedOptions={leftOperandOptions}
              value={config.formatLeftOperandValue(condition)}
              onChangeValue={(val: string, option) => {
                handleLeftOperandChange(condition, val, option);
              }}
            />
          </div>
          <div className="col-span-4">
            <InputCombobox
              id={`condition-${depth}-${index}-conditionOperator`}
              key="conditionOperator"
              showSearch={false}
              options={operatorOptions}
              value={condition.operator}
              onChangeValue={(val: string) => {
                handleOperatorChange(condition, val);
              }}
            />
          </div>
          <div className="col-span-4">
            {show && (
              <InputCombobox
                id={`condition-${depth}-${index}-conditionMatchValue`}
                withInput={showInput}
                inputProps={{
                  type: inputType,
                  placeholder: t("environments.surveys.edit.select_or_type_value"),
                }}
                key="conditionMatchValue"
                showSearch={false}
                groupedOptions={options}
                allowMultiSelect={allowMultiSelect}
                showCheckIcon={allowMultiSelect}
                value={condition.rightOperand?.value}
                clearable={true}
                onChangeValue={(val, option) => {
                  handleRightOperandChange(condition, val, option);
                }}
              />
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger id={`condition-${depth}-${index}-dropdown`} asChild>
            <Button
              variant="outline"
              className="flex h-10 w-10 items-center justify-center rounded-md bg-white">
              <EllipsisVerticalIcon className="h-4 w-4 text-slate-700 hover:text-slate-950" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              onClick={() => {
                callbacks.onAddConditionBelow(condition.id);
              }}
              icon={<PlusIcon className="h-4 w-4" />}>
              {t("environments.surveys.edit.add_condition_below")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => callbacks.onRemoveCondition(condition.id)}
              icon={<TrashIcon className="h-4 w-4" />}>
              {t("common.remove")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => callbacks.onDuplicateCondition(condition.id)}
              icon={<CopyIcon className="h-4 w-4" />}>
              {t("common.duplicate")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => callbacks.onCreateGroup(condition.id)}
              icon={<WorkflowIcon className="h-4 w-4" />}>
              {t("environments.surveys.edit.create_group")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  return (
    <div ref={parent} className="flex flex-col gap-y-4">
      {/* Dropdown for changing the connector */}
      {conditions.conditions.length > 1 && (
        <div className="flex items-center gap-x-2 text-sm">
          <p className="flex w-10 shrink-0 items-center justify-end font-medium text-slate-900">When</p>
          <Select
            value={conditions.connector}
            onValueChange={() => {
              callbacks.onToggleGroupConnector(conditions.id);
            }}>
            <SelectTrigger className="w-auto bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="flex min-w-fit max-w-fit items-center justify-between">
              <SelectItem value="and">all are true</SelectItem>
              <SelectItem value="or">any is true</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex flex-col gap-y-2">
        {conditions?.conditions.map((condition, index) => renderCondition(condition, index, conditions))}
      </div>
    </div>
  );
}
