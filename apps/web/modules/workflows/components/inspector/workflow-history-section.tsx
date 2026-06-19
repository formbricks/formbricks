"use client";

import { ArrowLeftIcon, ArrowRightIcon, DownloadIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { InspectorSection } from "@/modules/workflows/components/inspector/workflow-inspector-section";
import type { TWorkflowHistorySummary } from "@/modules/workflows/lib/placeholder-data";

const HISTORY_PAGE_SIZE = 5;

interface HistorySectionProps {
  history?: TWorkflowHistorySummary;
}

const HistoryStatCard = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-1 flex-col gap-1 rounded-md border border-slate-200 px-3 py-2">
    <span className="text-xs text-slate-500">{label}</span>
    <span className="text-sm font-semibold text-slate-900">{value}</span>
  </div>
);

export const HistorySection = ({ history }: Readonly<HistorySectionProps>) => {
  const { t } = useTranslation();
  const [historyRange, setHistoryRange] = useState("last_7_days");
  const [pageIndex, setPageIndex] = useState(0);

  const allRows = useMemo(() => history?.rows ?? [], [history?.rows]);
  const pageCount = Math.max(1, Math.ceil(allRows.length / HISTORY_PAGE_SIZE));
  // Clamp the page index if the row count shrinks (different workflow, smaller dataset).
  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  const visibleRows = useMemo(
    () => allRows.slice(safePageIndex * HISTORY_PAGE_SIZE, (safePageIndex + 1) * HISTORY_PAGE_SIZE),
    [allRows, safePageIndex]
  );

  const canGoPrev = safePageIndex > 0;
  const canGoNext = safePageIndex < pageCount - 1;

  return (
    <InspectorSection title={t("workspace.workflows.history_title")}>
      <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <Select value={historyRange} onValueChange={setHistoryRange}>
            <SelectTrigger className="w-auto gap-2 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last_24_hours">{t("workspace.workflows.history_range_last_24h")}</SelectItem>
              <SelectItem value="last_7_days">{t("workspace.workflows.history_range_last_7d")}</SelectItem>
              <SelectItem value="last_30_days">{t("workspace.workflows.history_range_last_30d")}</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" variant="secondary" size="sm" className="bg-white" disabled>
            {t("workspace.workflows.history_download_log")}
            <DownloadIcon />
          </Button>
        </div>

        <div className="flex gap-2">
          <HistoryStatCard
            label={t("workspace.workflows.history_total_runs")}
            value={history?.totalRuns ?? "0"}
          />
          <HistoryStatCard label={t("workspace.workflows.history_failed")} value={history?.failed ?? "0"} />
          <HistoryStatCard
            label={t("workspace.workflows.history_avg_run_time")}
            value={history?.avgRunTime ?? "—"}
          />
        </div>

        <div className="overflow-hidden rounded-md border border-slate-200">
          <div className="grid grid-cols-[1fr_auto] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
            <span>{t("workspace.workflows.history_col_date")}</span>
            <span>{t("workspace.workflows.history_col_status")}</span>
          </div>
          {visibleRows.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-[1fr_auto] items-center gap-2 border-b border-slate-100 px-3 py-2 text-xs last:border-b-0">
              <span className="truncate text-slate-700">{row.date}</span>
              <Badge
                text={
                  row.status === "success"
                    ? t("workspace.workflows.history_status_success")
                    : t("workspace.workflows.history_status_fail")
                }
                type={row.status === "success" ? "success" : "error"}
                size="tiny"
              />
            </div>
          ))}
          {allRows.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-slate-500">
              {t("workspace.workflows.history_empty")}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="bg-white"
            disabled={!canGoPrev}
            onClick={() => setPageIndex((current) => Math.max(0, current - 1))}>
            <ArrowLeftIcon />
            {t("common.previous")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="bg-white"
            disabled={!canGoNext}
            onClick={() => setPageIndex((current) => Math.min(pageCount - 1, current + 1))}>
            {t("common.next")}
            <ArrowRightIcon />
          </Button>
        </div>
      </div>
    </InspectorSection>
  );
};
