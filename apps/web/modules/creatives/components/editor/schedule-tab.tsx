"use client";

import { CalendarClockIcon, GlobeIcon } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DateTimePicker,
  useEditorTimeZone,
  validateDateTimeRange,
} from "@/modules/ui/components/date-time-picker";
import type { TCreative } from "../../types";
import { EditorField, EditorPanel } from "./editor-primitives";

export const ScheduleTab = ({
  creative,
  onChange,
}: Readonly<{ creative: TCreative; onChange: (creative: TCreative) => void }>) => {
  const { t, i18n } = useTranslation();
  const ids = useId();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const [today] = useState(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  });
  const timeZone = useEditorTimeZone();
  const zoneNoteId = `${ids}-zone`;
  const rangeError = validateDateTimeRange(creative.startsAt, creative.endsAt);

  return (
    <EditorPanel
      title={t("workspace.creatives.editor.schedule")}
      icon={CalendarClockIcon}
      description={t("workspace.creatives.editor.schedule_description")}>
      <div className="grid gap-4 sm:grid-cols-2">
        <EditorField label={t("workspace.creatives.editor.starts")} htmlFor={`${ids}-start`}>
          <DateTimePicker
            id={`${ids}-start`}
            label={t("workspace.creatives.editor.starts")}
            locale={locale}
            value={creative.startsAt}
            onChange={(startsAt) => onChange({ ...creative, startsAt })}
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
            value={creative.endsAt}
            onChange={(endsAt) => onChange({ ...creative, endsAt })}
            minDate={creative.startsAt ?? today}
            placeholder={t("workspace.creatives.editor.ends_placeholder")}
            error={rangeError ? t("workspace.creatives.editor.end_before_start") : undefined}
            aria-describedby={zoneNoteId}
          />
        </EditorField>
      </div>
      {timeZone && (
        <p
          id={zoneNoteId}
          className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
          <GlobeIcon className="size-3.5" aria-hidden="true" />
          {t("common.times_in", { timeZone })}
        </p>
      )}
    </EditorPanel>
  );
};
