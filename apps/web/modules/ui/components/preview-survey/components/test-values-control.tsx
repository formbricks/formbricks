"use client";

import { FlaskConicalIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TEmbeddedDataType } from "@formbricks/types/embedded-data";
import { cn } from "@/lib/cn";
import { parseStoredDay } from "@/lib/utils/datetime";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { DataTypeBadge } from "@/modules/ui/components/data-type-badge";
import { DatePicker } from "@/modules/ui/components/date-picker";
import { TruncationTooltip } from "@/modules/ui/components/info-tooltip";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { type TTestValueField, formatTestValuesList, toTestDateValue } from "../lib/test-values";

/** Radix refuses an empty item value, so "not set" travels as a sentinel and is mapped back. */
const NOT_SET_VALUE = "__not_set__";

/** The app's language, for the date picker and the list in the strip. */
const useAppLocale = (): string => {
  const { i18n } = useTranslation();
  return i18n.resolvedLanguage ?? i18n.language ?? "en-US";
};

interface TestValueInputProps {
  readonly id: string;
  readonly dataType: TEmbeddedDataType;
  /** The draft as typed. What reaches the preview is `getTestValueEntries`' reading of it. */
  readonly value: string;
  readonly onChange: (value: string) => void;
}

/**
 * One test value, typed by its field (ENG-6953): a number field takes a number, a date field a day
 * from the date picker, a true/false field a choice. Each writes what a real `?key=` link carries.
 * Mirrors `DefaultValueInput` in Embedded Data, with "Not set" instead of "No default".
 */
const TestValueInput = ({ id, dataType, value, onChange }: TestValueInputProps) => {
  const { t } = useTranslation();
  const locale = useAppLocale();

  if (dataType === "boolean") {
    return (
      <Select
        value={value === "true" || value === "false" ? value : NOT_SET_VALUE}
        onValueChange={(next) => onChange(next === NOT_SET_VALUE ? "" : next)}>
        <SelectTrigger id={id} className="h-8 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NOT_SET_VALUE}>{t("common.not_set")}</SelectItem>
          <SelectItem value="true">{t("workspace.embedded_data.value_true")}</SelectItem>
          <SelectItem value="false">{t("workspace.embedded_data.value_false")}</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  if (dataType === "date") {
    return (
      <DatePicker
        value={parseStoredDay(value)}
        locale={locale}
        className="w-full"
        triggerClassName="h-8 w-full flex-1"
        onChange={(date) => onChange(toTestDateValue(date))}
        onClear={() => onChange("")}
      />
    );
  }

  return (
    <Input
      id={id}
      type={dataType === "number" ? "number" : "text"}
      inputMode={dataType === "number" ? "decimal" : undefined}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-8"
    />
  );
};

interface TestValuesControlProps {
  /** The survey's URL parameters and hidden fields, by storage key, with their type. */
  readonly fields: readonly TTestValueField[];
  readonly values: Record<string, string>;
  /** How many values the preview runs with now: the button turns solid and shows it (T13 ②). */
  readonly activeCount: number;
  /** Applies the values and restarts the preview with them. */
  readonly onApply: (values: Record<string, string>) => void;
}

/**
 * The preview's "Test values" control (ENG-6932, P15): values for URL parameters and hidden fields,
 * so rules before the first question can be tried without leaving the editor. Empty by default; the
 * values are edited as a draft and applied together, because applying restarts the preview.
 */
export const TestValuesControl = ({ fields, values, activeCount, onApply }: TestValuesControlProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>(values);

  if (fields.length === 0) return null;

  const apply = (next: Record<string, string>) => {
    onApply(next);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (isOpen) setDraft(values);
      }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={activeCount > 0 ? "default" : "ghost"}
          id="preview-test-values"
          className={cn(
            "mr-1 h-fit px-2 py-0 font-sans text-sm",
            activeCount > 0 ? "gap-1.5" : "bg-white text-slate-500"
          )}>
          {t("workspace.surveys.edit.test_values")}
          {activeCount > 0 && (
            <Badge
              type="gray"
              size="tiny"
              text={String(activeCount)}
              className="border-transparent py-0 tabular-nums"
            />
          )}
          <FlaskConicalIcon className={cn("size-4", activeCount === 0 && "ml-2")} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            apply(draft);
          }}>
          <div>
            <p className="text-sm font-semibold text-slate-900">{t("workspace.surveys.edit.test_values")}</p>
            <p className="text-xs text-slate-500">{t("workspace.surveys.edit.test_values_description")}</p>
          </div>
          {fields.map(({ key, dataType }) => (
            <div key={key} className="flex flex-col gap-1">
              <Label htmlFor={`preview-test-value-${key}`} className="flex items-center gap-1.5">
                <DataTypeBadge dataType={dataType} showLabel={false} className="[&_svg]:size-3.5" />
                <span className="font-mono text-xs">{key}</span>
              </Label>
              <TestValueInput
                id={`preview-test-value-${key}`}
                dataType={dataType}
                value={draft[key] ?? ""}
                onChange={(value) => setDraft((current) => ({ ...current, [key]: value }))}
              />
            </div>
          ))}
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => apply({})}>
              {t("common.clear")}
            </Button>
            <Button type="submit" size="sm">
              {t("workspace.surveys.edit.test_values_apply")}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
};

interface TestValuesStripProps {
  /** The values the preview runs with, in the fields' order. Renders nothing when there are none. */
  readonly entries: readonly [string, string][];
  /** Clears every value, which restarts the preview without them. */
  readonly onClear: () => void;
  readonly className?: string;
}

/**
 * The strip above the previewed survey while test values are on (ENG-6969 T13 ②): "Previewing with
 * panel_id = 4711 and seg = heavy", with Clear. Nobody previews with values they forgot they set.
 */
export const TestValuesStrip = ({ entries, onClear, className }: TestValuesStripProps) => {
  const { t } = useTranslation();
  const locale = useAppLocale();

  if (entries.length === 0) return null;

  const text = t("workspace.surveys.edit.previewing_with_test_values", {
    values: formatTestValuesList(entries, locale),
  });

  return (
    <div
      data-testid="preview-test-values-strip"
      className={cn(
        "flex w-full min-w-0 items-center gap-2 border-b border-slate-200 bg-slate-50 py-1 pr-1 pl-3 text-xs text-slate-700",
        className
      )}>
      <FlaskConicalIcon className="size-3.5 shrink-0 text-slate-500" aria-hidden="true" />
      <TruncationTooltip content={text} className="min-w-0 flex-1 truncate" side="bottom">
        {text}
      </TruncationTooltip>
      <Button type="button" variant="ghost" size="sm" className="h-6 shrink-0 px-2 text-xs" onClick={onClear}>
        {t("common.clear")}
      </Button>
    </div>
  );
};
