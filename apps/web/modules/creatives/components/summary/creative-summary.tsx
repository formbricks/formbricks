"use client";

import {
  CalendarClockIcon,
  ClockIcon,
  LinkIcon,
  MessageCircleIcon,
  RefreshCcwIcon,
  SquarePenIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { formatDateTimeForDisplay } from "@/lib/utils/datetime";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { Button } from "@/modules/ui/components/button";
import { IconBar } from "@/modules/ui/components/iconbar";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { useCreativeResource, useUpdateCreative } from "../../hooks/use-creative-editor";
import { useCreativeStats } from "../../hooks/use-creative-summary";
import type { TCreativeResource } from "../../lib/editor-form";
import { getCreativeEditPath } from "../../lib/paths";
import {
  type TCreativeStatsRangeSelection,
  type TStatusChangeOutcome,
  type TSummaryStatus,
  buildCreativeStatsSearchParams,
  getStatusChangeOutcome,
  getSummaryStatusControl,
  resolveCreativeStatsRange,
} from "../../lib/summary";
import { getUiLocale } from "../../lib/ui-locale";
import { CreativeTypeIndicator, INDICATOR_TYPES } from "../creative-icons";
import { CreativeStatusPill } from "../creative-status-pill";
import { CreativeSummaryStatsSkeleton } from "../skeletons";
import { CreativeStatusDropdown } from "./creative-status-dropdown";
import { CreativeSummaryStats } from "./creative-summary-stats";
import { StatsRangeFilter } from "./stats-range-filter";

const SCHEDULE_OPTIONS: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" };

/** What it opens and when it shows, under the title where the survey summary has its tabs. */
const CreativeFacts = ({ creative }: Readonly<{ creative: TCreativeResource }>) => {
  const { t, i18n } = useTranslation();
  const locale = getUiLocale(i18n);
  const { destination, schedule } = creative;
  const formatAt = (at: string) => formatDateTimeForDisplay(new Date(at), locale, SCHEDULE_OPTIONS);

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pb-4 text-sm text-slate-600">
      <CreativeTypeIndicator type={INDICATOR_TYPES[creative.type]} />
      {destination?.type === "survey" && (
        <span className="inline-flex items-center gap-1.5">
          <MessageCircleIcon className="size-4 text-slate-400" aria-hidden="true" />
          {t("workspace.creatives.summary.opens_survey", { name: destination.surveyName })}
        </span>
      )}
      {destination?.type === "link" && (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <LinkIcon className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
          <span className="truncate">{destination.url}</span>
        </span>
      )}
      {(schedule.startAt || schedule.endAt) && (
        <span className="inline-flex items-center gap-1.5">
          <CalendarClockIcon className="size-4 text-slate-400" aria-hidden="true" />
          {schedule.startAt ? formatAt(schedule.startAt) : t("workspace.creatives.editor.starts_placeholder")}
          {" – "}
          {schedule.endAt ? formatAt(schedule.endAt) : t("workspace.creatives.editor.ends_placeholder")}
        </span>
      )}
    </div>
  );
};

interface CreativeSummaryProps {
  workspaceId: string;
  initialCreative: TCreativeResource;
  isReadOnly: boolean;
}

export const CreativeSummary = ({
  workspaceId,
  initialCreative,
  isReadOnly,
}: Readonly<CreativeSummaryProps>) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: creative, refetch: refetchCreative } = useCreativeResource(initialCreative);
  const [selection, setSelection] = useState<TCreativeStatsRangeSelection>({ preset: "last 30 days" });
  // When "today" is: set on load and whenever a range is picked, so a rolling preset follows the UTC day.
  const [now, setNow] = useState(() => new Date());
  const range = resolveCreativeStatsRange(selection, now);
  const stats = useCreativeStats(creative.id, buildCreativeStatsSearchParams(selection, now).toString());
  const statusChange = useUpdateCreative(creative.id);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const fallbackError = t("common.something_went_wrong_please_try_again");

  const outcomeMessages: Record<TStatusChangeOutcome["message"], string> = {
    active: t("workspace.creatives.summary.toast_active"),
    scheduled: t("workspace.creatives.summary.toast_scheduled"),
    paused: t("workspace.creatives.summary.toast_paused"),
    closed: t("workspace.creatives.summary.toast_closed"),
    scheduleEnded: t("workspace.creatives.summary.toast_kept_closed"),
    surveyNotActive: t("workspace.creatives.summary.toast_waiting_for_survey"),
  };

  const changeStatus = (status: TSummaryStatus) =>
    statusChange.mutate(
      { status },
      {
        onSuccess: (updated) => {
          const outcome = getStatusChangeOutcome(status, updated);
          if (outcome.kind === "success") toast.success(outcomeMessages[outcome.message]);
          else toast(outcomeMessages[outcome.message], { duration: 6000 });
        },
        onError: (error) => toast.error(getV3ApiErrorMessage(error, fallbackError)),
      }
    );

  const refresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchCreative({ throwOnError: true }), stats.refetch({ throwOnError: true })]);
      toast.success(t("common.data_refreshed_successfully"));
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, fallbackError));
    } finally {
      setIsRefreshing(false);
    }
  };

  const statusControl = getSummaryStatusControl(creative, isReadOnly);
  const state = { status: creative.displayStatus, reason: creative.displayStatusReason };

  let body: ReactNode;
  if (stats.data) {
    body = <CreativeSummaryStats stats={stats.data} isUpdating={stats.isPlaceholderData} />;
  } else if (stats.isError) {
    body = (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-slate-200 bg-white py-16 text-sm text-slate-600">
        <p>{getV3ApiErrorMessage(stats.error, fallbackError)}</p>
        <Button variant="secondary" size="sm" onClick={() => stats.refetch()}>
          {t("common.try_again")}
        </Button>
      </div>
    );
  } else {
    body = <CreativeSummaryStatsSkeleton />;
  }

  return (
    <PageContentWrapper>
      <PageHeader
        pageTitle={creative.name || t("workspace.creatives.untitled_creative")}
        cta={
          <div className="flex shrink-0 items-center gap-x-1.5">
            {statusControl.kind === "select" ? (
              <CreativeStatusDropdown
                value={statusControl.value}
                state={state}
                disabled={statusChange.isPending}
                onChange={changeStatus}
              />
            ) : (
              <CreativeStatusPill state={state} />
            )}
            <IconBar
              actions={[
                {
                  icon: RefreshCcwIcon,
                  tooltip: t("common.refresh"),
                  onClick: refresh,
                  disabled: isRefreshing,
                  isVisible: true,
                },
                {
                  icon: SquarePenIcon,
                  tooltip: t("common.edit"),
                  onClick: () => router.push(getCreativeEditPath(workspaceId, creative.id)),
                  // Read-only members can't open the editor; it sends them back to the list.
                  isVisible: !isReadOnly,
                },
              ]}
            />
          </div>
        }>
        <CreativeFacts creative={creative} />
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatsRangeFilter
          selection={selection}
          range={range}
          now={now}
          onChange={(next) => {
            setNow(new Date());
            setSelection(next);
          }}
        />
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          <ClockIcon className="size-3.5" aria-hidden="true" />
          {t("workspace.creatives.summary.freshness")}
        </span>
      </div>

      {body}
    </PageContentWrapper>
  );
};
