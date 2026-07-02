"use client";

import { CalendarClockIcon, LayersIcon, MessageSquareTextIcon, ShapesIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatDateTimeForDisplay } from "@/lib/utils/datetime";
import type { TFeedbackDatasetOverview } from "../lib/overview";

interface DatasetOverviewHeaderProps {
  overview: TFeedbackDatasetOverview;
  locale: string;
}

const EM_DASH = "—";

/**
 * Presentational summary strip above the records table (decision #3). Purely props-driven — the SSR
 * page fetches the stats — and renders "—" for any value the Hub couldn't supply, so an unreachable
 * Hub degrades gracefully instead of blanking the page.
 */
export const DatasetOverviewHeader = ({ overview, locale }: Readonly<DatasetOverviewHeaderProps>) => {
  const { t } = useTranslation();

  const formatCount = (value: number | null): string => (value == null ? EM_DASH : String(value));
  const lastCollected =
    overview.lastCollectedAt == null
      ? EM_DASH
      : formatDateTimeForDisplay(new Date(overview.lastCollectedAt), locale);

  const items = [
    {
      key: "records",
      label: t("workspace.unify.overview_records"),
      value: formatCount(overview.recordCount),
      icon: <MessageSquareTextIcon className="size-4 text-slate-400" aria-hidden="true" />,
    },
    {
      key: "sources",
      label: t("workspace.unify.overview_sources"),
      value: formatCount(overview.sourceCount),
      icon: <ShapesIcon className="size-4 text-slate-400" aria-hidden="true" />,
    },
    {
      key: "topics",
      label: t("workspace.unify.overview_topics"),
      value: formatCount(overview.topicFieldCount),
      icon: <LayersIcon className="size-4 text-slate-400" aria-hidden="true" />,
    },
    {
      key: "last_collected",
      label: t("workspace.unify.overview_last_collected"),
      value: lastCollected,
      icon: <CalendarClockIcon className="size-4 text-slate-400" aria-hidden="true" />,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.key}
          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xs">
          {item.icon}
          <div className="min-w-0">
            <p className="text-xs text-slate-500">{item.label}</p>
            <p className="truncate text-sm font-semibold text-slate-900" title={item.value}>
              {item.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};
