"use client";

import { createId } from "@paralleldrive/cuid2";
import {
  CheckCircle2Icon,
  CircleDashedIcon,
  FilterIcon,
  GlobeIcon,
  PlusIcon,
  XCircleIcon,
  XIcon,
} from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  SHOW_CONDITION_BROWSERS,
  SHOW_CONDITION_DEVICE_TYPES,
  SHOW_CONDITION_OPERANDS,
  type TShowConditionOperand,
  type TShowConditionOperandType,
  type TShowConditionOperator,
  type TShowConditionSingle,
  type TShowConditions,
} from "@formbricks/types/show-conditions";
import { cn } from "@/lib/cn";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import {
  createCondition,
  getOperators,
  getTopLevelConditions,
  getValueKind,
  isConditionComplete,
  setTopLevelConditions,
  testUrl,
  withOperator,
} from "../../lib/show-conditions-ui";
import { EditorPanel, Segmented } from "./editor-primitives";

const BROWSER_NAMES: Record<(typeof SHOW_CONDITION_BROWSERS)[number], string> = {
  chrome: "Chrome",
  safari: "Safari",
  firefox: "Firefox",
  edge: "Edge",
  opera: "Opera",
  samsung: "Samsung Internet",
  other: "",
};

const useConditionLabels = () => {
  const { t } = useTranslation();
  const operandTypes: Record<TShowConditionOperandType, string> = {
    page: t("workspace.creatives.conditions.group_page"),
    visit: t("workspace.creatives.conditions.group_visit"),
    device: t("workspace.creatives.conditions.group_device"),
  };
  const operands: Record<TShowConditionOperand, string> = {
    currentUrl: t("workspace.creatives.conditions.operand_current_url"),
    pageReferrer: t("workspace.creatives.conditions.operand_page_referrer"),
    entryReferrer: t("workspace.creatives.conditions.operand_entry_referrer"),
    queryParam: t("workspace.creatives.conditions.operand_query_param"),
    pagesViewed: t("workspace.creatives.conditions.operand_pages_viewed"),
    uniquePagesViewed: t("workspace.creatives.conditions.operand_unique_pages_viewed"),
    timeOnSite: t("workspace.creatives.conditions.operand_time_on_site"),
    visitedUrls: t("workspace.creatives.conditions.operand_visited_urls"),
    deviceType: t("workspace.creatives.conditions.operand_device_type"),
    browser: t("workspace.creatives.conditions.operand_browser"),
    screenWidth: t("workspace.creatives.conditions.operand_window_width"),
  };
  const operators: Record<TShowConditionOperator, string> = {
    equals: t("workspace.creatives.conditions.operator_equals"),
    doesNotEqual: t("workspace.creatives.conditions.operator_does_not_equal"),
    contains: t("workspace.creatives.conditions.operator_contains"),
    doesNotContain: t("workspace.creatives.conditions.operator_does_not_contain"),
    startsWith: t("workspace.creatives.conditions.operator_starts_with"),
    endsWith: t("workspace.creatives.conditions.operator_ends_with"),
    containsAnyOf: t("workspace.creatives.conditions.operator_contains_any_of"),
    containsNoneOf: t("workspace.creatives.conditions.operator_contains_none_of"),
    isGreaterThan: t("workspace.creatives.conditions.operator_greater_than"),
    isLessThan: t("workspace.creatives.conditions.operator_less_than"),
    isGreaterThanOrEqual: t("workspace.creatives.conditions.operator_at_least"),
    isLessThanOrEqual: t("workspace.creatives.conditions.operator_at_most"),
    includes: t("workspace.creatives.conditions.operator_includes"),
    doesNotInclude: t("workspace.creatives.conditions.operator_does_not_include"),
    isSet: t("workspace.creatives.conditions.operator_is_set"),
    isNotSet: t("workspace.creatives.conditions.operator_is_not_set"),
  };
  const devices: Record<(typeof SHOW_CONDITION_DEVICE_TYPES)[number], string> = {
    phone: t("common.phone"),
    tablet: t("workspace.creatives.conditions.device_tablet"),
    desktop: t("workspace.creatives.editor.desktop"),
  };
  const browsers = { ...BROWSER_NAMES, other: t("common.other") };
  return { operandTypes, operands, operators, devices, browsers };
};

const ConditionValue = ({
  condition,
  onChange,
  showError,
}: Readonly<{
  condition: TShowConditionSingle;
  onChange: (next: TShowConditionSingle) => void;
  showError: boolean;
}>) => {
  const { t } = useTranslation();
  const labels = useConditionLabels();
  const kind = getValueKind(condition.leftOperand.value, condition.operator);
  const value = condition.rightOperand?.value;
  const setValue = (next: string | number | string[]) =>
    onChange({ ...condition, rightOperand: { type: "static", value: next } });

  if (kind === "none") return null;
  if (kind === "deviceType" || kind === "browser") {
    const options = kind === "deviceType" ? SHOW_CONDITION_DEVICE_TYPES : SHOW_CONDITION_BROWSERS;
    const optionLabels: Record<string, string> = kind === "deviceType" ? labels.devices : labels.browsers;
    return (
      <Select value={String(value)} onValueChange={setValue}>
        <SelectTrigger className="bg-white" aria-label={t("workspace.creatives.conditions.value")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {optionLabels[option]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (kind === "number") {
    return (
      <Input
        type="number"
        min={0}
        className="bg-white"
        aria-label={t("workspace.creatives.conditions.value")}
        value={typeof value === "number" ? value : 0}
        onChange={(event) => setValue(Number(event.target.value))}
      />
    );
  }
  const text = Array.isArray(value) ? value.join(", ") : String(value ?? "");
  return (
    <Input
      className="bg-white"
      aria-label={t("workspace.creatives.conditions.value")}
      placeholder={
        kind === "list"
          ? t("workspace.creatives.conditions.list_placeholder")
          : t("workspace.creatives.conditions.text_placeholder")
      }
      value={text}
      isInvalid={showError && !isConditionComplete(condition)}
      onChange={(event) =>
        setValue(
          kind === "list"
            ? event.target.value
                .split(",")
                .map((entry) => entry.trim())
                .filter(Boolean)
            : event.target.value
        )
      }
    />
  );
};

/**
 * Show when: the shared show conditions (ADR 0007), edited as one flat group. `children` sits at the
 * bottom of the card: creatives put Share of visitors there.
 */
export const ShowConditionsCard = ({
  value,
  onChange,
  showErrors,
  children,
}: Readonly<{
  value: TShowConditions;
  onChange: (value: TShowConditions) => void;
  showErrors: boolean;
  children?: React.ReactNode;
}>) => {
  const { t } = useTranslation();
  const ids = useId();
  const labels = useConditionLabels();
  const [testInput, setTestInput] = useState("");
  const conditions = getTopLevelConditions(value);
  const test = testInput.trim() ? testUrl(value, testInput.trim()) : null;

  const write = (next: TShowConditionSingle[]) => onChange(setTopLevelConditions(value, next, createId()));
  const replace = (next: TShowConditionSingle) =>
    write(conditions.map((condition) => (condition.id === next.id ? next : condition)));

  return (
    <EditorPanel
      title={t("workspace.creatives.conditions.title")}
      icon={FilterIcon}
      description={t("workspace.creatives.conditions.description")}>
      {conditions.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-sm text-slate-500">
          <GlobeIcon className="size-4" aria-hidden="true" />
          {t("workspace.creatives.conditions.always")}
        </div>
      ) : (
        <>
          {conditions.length > 1 && value && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              {t("workspace.creatives.conditions.match_prefix")}
              <Segmented
                ariaLabel={t("workspace.creatives.conditions.match_prefix")}
                value={value.connector}
                onChange={(connector) => onChange({ ...value, connector })}
                options={[
                  { value: "and", label: t("workspace.creatives.conditions.all") },
                  { value: "or", label: t("workspace.creatives.conditions.any") },
                ]}
              />
              {t("workspace.creatives.conditions.match_suffix")}
            </div>
          )}
          <ul className="space-y-2">
            {conditions.map((condition) => {
              const operand = condition.leftOperand.value;
              const outcome = test?.byCondition[condition.id];
              return (
                <li
                  key={condition.id}
                  className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                  <div className="flex items-center gap-2">
                    <Select
                      value={operand}
                      onValueChange={(next) =>
                        replace(createCondition(next as TShowConditionOperand, condition.id))
                      }>
                      <SelectTrigger
                        className="bg-white"
                        aria-label={t("workspace.creatives.conditions.operand")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(SHOW_CONDITION_OPERANDS) as TShowConditionOperandType[]).map((type) => (
                          <SelectGroup key={type}>
                            <SelectLabel>{labels.operandTypes[type]}</SelectLabel>
                            {SHOW_CONDITION_OPERANDS[type].map((option) => (
                              <SelectItem key={option} value={option}>
                                {labels.operands[option]}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                    {test && (
                      <span className="shrink-0" title={t("workspace.creatives.conditions.test_title")}>
                        {outcome === true && <CheckCircle2Icon className="size-4 text-emerald-600" />}
                        {outcome === false && <XCircleIcon className="size-4 text-red-500" />}
                        {outcome === null && <CircleDashedIcon className="size-4 text-slate-400" />}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-slate-500"
                      aria-label={t("workspace.creatives.conditions.remove")}
                      onClick={() => write(conditions.filter((item) => item.id !== condition.id))}>
                      <XIcon />
                    </Button>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-2">
                    {operand === "queryParam" && (
                      <Input
                        className="col-span-2 bg-white"
                        aria-label={t("workspace.creatives.conditions.param_key")}
                        placeholder={t("workspace.creatives.conditions.param_key_placeholder")}
                        value={condition.leftOperand.meta?.key ?? ""}
                        isInvalid={showErrors && !condition.leftOperand.meta?.key.trim()}
                        onChange={(event) =>
                          replace({
                            ...condition,
                            leftOperand: { ...condition.leftOperand, meta: { key: event.target.value } },
                          })
                        }
                      />
                    )}
                    <Select
                      value={condition.operator}
                      onValueChange={(next) =>
                        replace(withOperator(condition, next as TShowConditionOperator))
                      }>
                      <SelectTrigger
                        className={cn(
                          "bg-white",
                          getValueKind(operand, condition.operator) === "none" && "col-span-2"
                        )}
                        aria-label={t("workspace.creatives.conditions.operator")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {getOperators(operand).map((operator) => (
                          <SelectItem key={operator} value={operator}>
                            {labels.operators[operator]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <ConditionValue condition={condition} onChange={replace} showError={showErrors} />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="-ml-2"
        onClick={() => write([...conditions, createCondition("currentUrl", createId())])}>
        <PlusIcon />
        {t("workspace.creatives.conditions.add")}
      </Button>

      {conditions.length > 0 && (
        <div className="space-y-2 border-t border-slate-100 pt-4">
          <label htmlFor={`${ids}-test`} className="text-sm font-medium text-slate-700">
            {t("workspace.creatives.conditions.test_title")}
          </label>
          <Input
            id={`${ids}-test`}
            type="url"
            placeholder="https://"
            value={testInput}
            onChange={(event) => setTestInput(event.target.value)}
          />
          {test && (
            <p
              className={cn(
                "flex items-center gap-1.5 text-xs",
                test.passed ? "text-emerald-700" : "text-slate-600"
              )}>
              {test.passed ? <CheckCircle2Icon className="size-3.5" /> : <XCircleIcon className="size-3.5" />}
              {test.passed
                ? t("workspace.creatives.conditions.test_passed")
                : t("workspace.creatives.conditions.test_failed")}
            </p>
          )}
        </div>
      )}
      {children}
    </EditorPanel>
  );
};
