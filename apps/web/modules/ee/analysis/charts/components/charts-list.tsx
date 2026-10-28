"use client";

import { useTranslation } from "react-i18next";
import type { TAIUnavailableReason } from "@/lib/ai/service";
import { ChartRow } from "@/modules/ee/analysis/charts/components/chart-row";
import { ChartsListSkeleton } from "@/modules/ee/analysis/charts/components/charts-list-skeleton";
import { CreateChartButton } from "@/modules/ee/analysis/charts/components/create-chart-button";
import { useCharts } from "@/modules/ee/analysis/charts/hooks/use-charts";
import { ListLoadError } from "@/modules/ee/analysis/components/list-load-error";
import { LoadMoreOnScroll } from "@/modules/ee/analysis/components/load-more-on-scroll";

/** Rows per page: enough to fill a screen, few enough that the first paint stays fast. */
const CHARTS_PAGE_SIZE = 25;

interface ChartsListProps {
  workspaceId: string;
  isReadOnly: boolean;
  directories: { id: string; name: string }[];
  isAIAvailable: boolean;
  aiUnavailableReason?: TAIUnavailableReason;
}

export const ChartsList = ({
  workspaceId,
  isReadOnly,
  directories,
  isAIAvailable,
  aiUnavailableReason,
}: Readonly<ChartsListProps>) => {
  const { t } = useTranslation();
  const { charts, isPending, isError, error, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useCharts({ workspaceId, limit: CHARTS_PAGE_SIZE });

  const columnHeaders: [string, string, string, string] = [
    t("common.title"),
    t("common.created_by"),
    t("common.created_at"),
    t("common.updated_at"),
  ];

  if (isPending) return <ChartsListSkeleton columnHeaders={columnHeaders} />;
  if (isError) return <ListLoadError error={error} onRetry={refetch} />;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
      <div className="grid h-12 grid-cols-7 content-center border-b text-left text-sm font-semibold text-slate-900">
        <div className="col-span-3 pl-6">{columnHeaders[0]}</div>
        <div className="col-span-1 hidden text-center sm:block">{columnHeaders[1]}</div>
        <div className="col-span-1 hidden text-center sm:block">{columnHeaders[2]}</div>
        <div className="col-span-1 hidden text-center sm:block">{columnHeaders[3]}</div>
        <div className="col-span-1" />
      </div>
      {charts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-900">
              {t("workspace.analysis.charts.no_charts_found")}
            </p>
            <p className="text-sm text-slate-500">
              {t("workspace.analysis.charts.no_charts_found_description")}
            </p>
          </div>
          {!isReadOnly && (
            <CreateChartButton
              workspaceId={workspaceId}
              directories={directories}
              buttonProps={{ variant: "secondary" }}
              isAIAvailable={isAIAvailable}
              aiUnavailableReason={aiUnavailableReason}
            />
          )}
        </div>
      ) : (
        <>
          {charts.map((chart) => (
            <ChartRow
              key={chart.id}
              chart={chart}
              workspaceId={workspaceId}
              isReadOnly={isReadOnly}
              directories={directories}
            />
          ))}
          <LoadMoreOnScroll
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            fetchNextPage={fetchNextPage}
          />
        </>
      )}
    </div>
  );
};
