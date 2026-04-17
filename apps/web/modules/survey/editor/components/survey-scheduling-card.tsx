"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { ChevronDownIcon } from "lucide-react";
import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { cn } from "@/lib/cn";
import { formatDateForDisplay } from "@/lib/utils/datetime";
import {
  getCurrentFixedCETCalendarDate,
  toCalendarDate,
  toDateOnlySelection,
} from "@/modules/survey/scheduling/lib/date-utils";
import { DatePicker } from "@/modules/ui/components/date-picker";

interface SurveySchedulingCardProps {
  localSurvey: TSurvey;
  locale: TUserLocale;
  setLocalSurvey: Dispatch<SetStateAction<TSurvey>>;
}

export const SurveySchedulingCard = ({ localSurvey, locale, setLocalSurvey }: SurveySchedulingCardProps) => {
  const { t } = useTranslation();
  const publishOn = localSurvey.publishOn ? toCalendarDate(localSurvey.publishOn) : null;
  const pauseOn = localSurvey.pauseOn ? toCalendarDate(localSurvey.pauseOn) : null;
  const minDate = getCurrentFixedCETCalendarDate();
  const hasScheduledDates = publishOn !== null || pauseOn !== null;
  const [open, setOpen] = useState(() => hasScheduledDates);

  useEffect(() => {
    if (hasScheduledDates) {
      setOpen(true);
    }
  }, [hasScheduledDates]);

  const scheduleSummary = [
    publishOn
      ? `${t("environments.surveys.edit.publish_on_date")}: ${formatDateForDisplay(publishOn, locale)}`
      : null,
    pauseOn
      ? `${t("environments.surveys.edit.pause_on_date")}: ${formatDateForDisplay(pauseOn, locale)}`
      : null,
  ].filter((value): value is string => value !== null);

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className={cn(open ? "" : "hover:bg-slate-50", "w-full rounded-lg border border-slate-300 bg-white")}>
      <Collapsible.CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-start justify-between gap-4 px-6 py-5 text-left"
          aria-label={t("environments.surveys.edit.survey_schedule")}>
          <div className="space-y-1">
            <h3 className="font-semibold text-slate-800">{t("environments.surveys.edit.survey_schedule")}</h3>
            {scheduleSummary.length > 0 ? (
              scheduleSummary.map((summaryLine) => (
                <p key={summaryLine} className="text-sm text-slate-500">
                  {summaryLine}
                </p>
              ))
            ) : (
              <p className="text-sm text-slate-500">
                {t("environments.surveys.edit.schedule_survey_publish_and_pause_dates")}
              </p>
            )}
          </div>
          <ChevronDownIcon
            className={cn("mt-1 h-5 w-5 shrink-0 text-slate-500 transition-transform", open && "rotate-180")}
          />
        </button>
      </Collapsible.CollapsibleTrigger>

      <Collapsible.CollapsibleContent className="border-t border-slate-200 px-6 py-5">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-800">
                {t("environments.surveys.edit.publish_on_date")}
              </p>
              <p className="text-xs text-slate-500">
                {t("environments.surveys.edit.survey_will_be_published_at_midnight_cet")}
              </p>
            </div>

            <DatePicker
              clearButtonId="clear-publish-on-date"
              clearButtonLabel={t("environments.surveys.edit.clear_publish_on_date")}
              date={publishOn}
              locale={locale}
              minDate={minDate}
              onClearDate={() => {
                setLocalSurvey((currentSurvey) => ({
                  ...currentSurvey,
                  publishOn: null,
                }));
              }}
              updateSurveyDate={(date) => {
                setLocalSurvey((currentSurvey) => ({
                  ...currentSurvey,
                  publishOn: toDateOnlySelection(date),
                }));
              }}
            />
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-800">
                {t("environments.surveys.edit.pause_on_date")}
              </p>
              <p className="text-xs text-slate-500">
                {t("environments.surveys.edit.survey_will_be_paused_at_midnight_cet")}
              </p>
            </div>

            <DatePicker
              clearButtonId="clear-pause-on-date"
              clearButtonLabel={t("environments.surveys.edit.clear_pause_on_date")}
              date={pauseOn}
              locale={locale}
              minDate={minDate}
              onClearDate={() => {
                setLocalSurvey((currentSurvey) => ({
                  ...currentSurvey,
                  pauseOn: null,
                }));
              }}
              updateSurveyDate={(date) => {
                setLocalSurvey((currentSurvey) => ({
                  ...currentSurvey,
                  pauseOn: toDateOnlySelection(date),
                }));
              }}
            />
          </div>
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};
