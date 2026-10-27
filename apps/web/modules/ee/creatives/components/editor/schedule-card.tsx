"use client";

import { CalendarClockIcon, GlobeIcon, InfoIcon } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DateTimePicker,
  useEditorTimeZone,
  validateDateTimeRange,
} from "@/modules/ui/components/date-time-picker";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";
import type { TCreativeEditorForm } from "../../lib/editor-form";
import { getUiLocale } from "../../lib/ui-locale";
import { EditorField, EditorPanel } from "./editor-primitives";
import { ScheduleSummary } from "./panel-summaries";

type TSchedule = TCreativeEditorForm["schedule"];

/**
 * The Schedule card on the Settings tab: start and end to the minute, in the editor's (browser's) time
 * zone; the API stores them as instants, and the SDK compares those with the visitor's clock (corrected
 * to the server's when it is off), so the zone only changes how the times read here.
 */
export const ScheduleCard = ({
  schedule,
  onChange,
}: Readonly<{ schedule: TSchedule; onChange: (schedule: TSchedule) => void }>) => {
  const { t, i18n } = useTranslation();
  const ids = useId();
  const locale = getUiLocale(i18n);
  const [today] = useState(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  });
  const timeZone = useEditorTimeZone();
  const zoneNoteId = `${ids}-zone`;
  const rangeError = validateDateTimeRange(schedule.startAt, schedule.endAt);

  return (
    <EditorPanel
      title={t("workspace.creatives.editor.schedule")}
      icon={CalendarClockIcon}
      description={t("workspace.creatives.editor.schedule_description")}
      fold={{
        id: "schedule",
        summary: <ScheduleSummary schedule={schedule} />,
        attention: rangeError ? "error" : undefined,
      }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <EditorField label={t("workspace.creatives.editor.starts")} htmlFor={`${ids}-start`}>
          <DateTimePicker
            id={`${ids}-start`}
            label={t("workspace.creatives.editor.starts")}
            locale={locale}
            value={schedule.startAt}
            onChange={(startAt) => onChange({ ...schedule, startAt })}
            minDate={today}
            placeholder={t("workspace.creatives.editor.starts_placeholder")}
            aria-describedby={zoneNoteId}
          />
        </EditorField>
        <EditorField label={t("workspace.creatives.editor.ends")} htmlFor={`${ids}-end`}>
          <DateTimePicker
            id={`${ids}-end`}
            label={t("workspace.creatives.editor.ends")}
            locale={locale}
            value={schedule.endAt}
            onChange={(endAt) => onChange({ ...schedule, endAt })}
            minDate={schedule.startAt ?? today}
            placeholder={t("workspace.creatives.editor.ends_placeholder")}
            error={rangeError ? t("workspace.creatives.editor.end_before_start") : undefined}
            aria-describedby={zoneNoteId}
          />
        </EditorField>
      </div>
      {timeZone && (
        // The zone is this browser's, not the visitors': the schedule is a pair of instants, so the
        // creative switches at the same moment everywhere. The chip says whose zone it is; the tooltip why.
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                id={zoneNoteId}
                className="inline-flex cursor-help items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-hidden">
                <GlobeIcon className="size-3.5" aria-hidden="true" />
                {t("workspace.creatives.editor.times_in_browser_zone", { timeZone })}
                <InfoIcon className="size-3.5 text-slate-400" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              {t("workspace.creatives.editor.times_in_browser_zone_tooltip")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </EditorPanel>
  );
};
