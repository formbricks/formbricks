"use client";

import { CheckIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { DATE_RANGE_PRESETS } from "@/lib/date-ranges";
import { getTranslatedDatePresetLabel } from "@/modules/ee/analysis/lib/schema-definition";
import { DateRangeCalendar, type TDateRangeValue } from "@/modules/ui/components/date-picker";
import { formatCalendarDay, parseCalendarDay } from "../lib/date-filter";
import type { TFilterProperty, TTableFilter } from "../lib/types";
import { datePresetFromSlug, datePresetToSlug } from "../lib/url-codec";

export type TDateFilterChange =
  | { operator: "preset"; preset: string }
  | { operator: "between"; from: string; to: string }
  | null;

/** A date quick filter: one of the shared presets, or a custom range of calendar days. */
export const DateFilterEditor = ({
  property,
  filter,
  onChange,
}: Readonly<{
  property: TFilterProperty;
  filter: TTableFilter | undefined;
  onChange: (next: TDateFilterChange) => void;
}>) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const presets = property.datePresets ?? DATE_RANGE_PRESETS;
  const activePreset = filter?.operator === "preset" ? datePresetFromSlug(filter.values[0]) : null;
  const [isCustomOpen, setIsCustomOpen] = useState(filter?.operator === "between");
  const [draft, setDraft] = useState<TDateRangeValue>(
    filter?.operator === "between"
      ? { from: parseCalendarDay(filter.values[0]), to: parseCalendarDay(filter.values[1]) }
      : { from: undefined }
  );

  const optionClass = (isActive: boolean) =>
    cn(
      "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden",
      isActive && "font-medium text-slate-900"
    );

  if (isCustomOpen) {
    return (
      <div className="flex flex-col gap-2 p-1">
        <DateRangeCalendar
          value={draft}
          locale={locale}
          numberOfMonths={1}
          onChange={setDraft}
          onComplete={(range) => {
            if (!range.from || !range.to) return;
            onChange({
              operator: "between",
              from: formatCalendarDay(range.from),
              to: formatCalendarDay(range.to),
            });
          }}
        />
        <button type="button" className={optionClass(false)} onClick={() => setIsCustomOpen(false)}>
          {t("common.back")}
        </button>
      </div>
    );
  }

  return (
    <ul className="flex w-52 flex-col py-1" aria-label={property.label}>
      {presets.map((preset) => (
        <li key={preset}>
          <button
            type="button"
            className={optionClass(activePreset === preset)}
            aria-pressed={activePreset === preset}
            onClick={() =>
              onChange(
                activePreset === preset ? null : { operator: "preset", preset: datePresetToSlug(preset) }
              )
            }>
            {getTranslatedDatePresetLabel(preset, t)}
            {activePreset === preset && <CheckIcon className="size-4" />}
          </button>
        </li>
      ))}
      <li className="mt-1 border-t border-slate-100 pt-1">
        <button
          type="button"
          className={optionClass(filter?.operator === "between")}
          onClick={() => setIsCustomOpen(true)}>
          {t("common.table_toolbar.custom_range")}
          {filter?.operator === "between" && <CheckIcon className="size-4" />}
        </button>
      </li>
    </ul>
  );
};
