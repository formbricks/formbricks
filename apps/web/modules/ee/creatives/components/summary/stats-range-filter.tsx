"use client";

import type { TFunction } from "i18next";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { parseLocalDay } from "@/lib/utils/datetime";
import { useClickOutside } from "@/lib/utils/hooks/useClickOutside";
import { DateRangeCalendar, type TDateRangeValue } from "@/modules/ui/components/date-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import type { TStatsRange } from "../../lib/stats";
import {
  CREATIVE_STATS_PRESETS,
  type TCreativeStatsPreset,
  type TCreativeStatsRangeSelection,
  formatStatsRange,
  getStatsToday,
} from "../../lib/summary";
import { getUiLocale } from "../../lib/ui-locale";

// The survey summary's date presets and words (its `CustomFilter` is bound to the responses filter, so
// it isn't reused as a whole). Literal `t()` calls keep the keys visible to the translation scanner.
const PRESET_LABELS: Record<TCreativeStatsPreset, (t: TFunction) => string> = {
  today: (t) => t("workspace.analysis.charts.date_preset_today"),
  yesterday: (t) => t("workspace.analysis.charts.date_preset_yesterday"),
  "last 7 days": (t) => t("workspace.surveys.summary.last_7_days"),
  "last 30 days": (t) => t("workspace.surveys.summary.last_30_days"),
  "last 90 days": (t) => t("workspace.surveys.summary.last_90_days"),
  "this month": (t) => t("workspace.surveys.summary.this_month"),
  "last month": (t) => t("workspace.surveys.summary.last_month"),
  "this quarter": (t) => t("workspace.surveys.summary.this_quarter"),
  "last quarter": (t) => t("workspace.surveys.summary.last_quarter"),
  "last 6 months": (t) => t("workspace.surveys.summary.last_6_months"),
  "this year": (t) => t("workspace.surveys.summary.this_year"),
  "last year": (t) => t("workspace.surveys.summary.last_year"),
};

interface StatsRangeFilterProps {
  selection: TCreativeStatsRangeSelection;
  /** The UTC days the selection resolved to, named next to the preset. */
  range: TStatsRange;
  now: Date;
  onChange: (selection: TCreativeStatsRangeSelection) => void;
}

/** A preset or a custom range of UTC days, the way the survey summary's date filter offers them. */
export const StatsRangeFilter = ({ selection, range, now, onChange }: Readonly<StatsRangeFilterProps>) => {
  const { t, i18n } = useTranslation();
  const locale = getUiLocale(i18n);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // The days being picked while the calendar is open; the query keeps the last complete range meanwhile.
  const [draft, setDraft] = useState<TDateRangeValue | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  useClickOutside(calendarRef, () => setDraft(null));

  return (
    <div className="relative">
      <DropdownMenu
        onOpenChange={(open) => {
          if (open) setDraft(null);
          setIsMenuOpen(open);
        }}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex min-w-32 cursor-pointer items-center justify-between rounded-md border border-slate-300 bg-white p-2 hover:border-slate-400">
            <span className="text-sm text-slate-700">
              {selection.preset && <span className="mr-1.5">{PRESET_LABELS[selection.preset](t)}</span>}
              <span className={selection.preset ? "text-slate-500" : undefined}>
                {formatStatsRange(range, locale)}
              </span>
            </span>
            {isMenuOpen ? (
              <ChevronUp className="ml-3 size-4 opacity-50" />
            ) : (
              <ChevronDown className="ml-3 size-4 opacity-50" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="max-h-[var(--radix-dropdown-menu-content-available-height)]">
          {CREATIVE_STATS_PRESETS.map((preset) => (
            <DropdownMenuItem key={preset} onClick={() => onChange({ preset })}>
              <p className="text-slate-700">{PRESET_LABELS[preset](t)}</p>
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem
            onClick={() => setDraft({ from: parseLocalDay(range.from), to: parseLocalDay(range.to) })}>
            <p className="text-slate-700">{t("workspace.surveys.summary.custom_range")}</p>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-normal text-slate-500">
            {t("workspace.creatives.summary.days_in_utc")}
          </DropdownMenuLabel>
        </DropdownMenuContent>
      </DropdownMenu>
      {draft && (
        <div ref={calendarRef} className="absolute top-full z-50 my-2 rounded-md border bg-white">
          <DateRangeCalendar
            value={draft}
            locale={locale}
            maxDate={getStatsToday(now)}
            onChange={setDraft}
            onComplete={({ from, to }) => {
              if (from && to) onChange({ preset: null, from, to });
              setDraft(null);
            }}
          />
        </div>
      )}
    </div>
  );
};
