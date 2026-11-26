"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TAIUnavailableReason } from "@/lib/ai/service";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { CreateChartButton } from "@/modules/ee/analysis/charts/components/create-chart-button";
import { useCharts } from "@/modules/ee/analysis/charts/hooks/use-charts";
import { ListLoadError } from "@/modules/ee/analysis/components/list-load-error";
import { LoadMoreOnScroll } from "@/modules/ee/analysis/components/load-more-on-scroll";
import { type TAppChart, getChart, getChartApiErrorMessage } from "@/modules/ee/analysis/lib/api-client";
import { Button } from "@/modules/ui/components/button";
import { Checkbox } from "@/modules/ui/components/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { Input } from "@/modules/ui/components/input";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";

interface AddExistingChartsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  /** The charts already on the page being edited: listed, but not picked again. */
  placedChartIds: ReadonlySet<string>;
  directories: { id: string; name: string }[];
  /** The charts picked, or the one just created, for the edit to place on its page. */
  onPick: (charts: TAppChart[]) => void;
  isAIAvailable?: boolean;
  aiUnavailableReason?: TAIUnavailableReason;
}

const CHARTS_PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Picks charts to put on a dashboard. The workspace's charts are searched on the server a page at a
 * time; a chart already on this dashboard — read from the chart's own embedded `dashboards` — is listed
 * but cannot be picked.
 */
export function AddExistingChartsDialog({
  open,
  onOpenChange,
  workspaceId,
  placedChartIds,
  directories,
  onPick,
  isAIAvailable,
  aiUnavailableReason,
}: Readonly<AddExistingChartsDialogProps>) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  // The picked charts themselves, not their ids: the list holds only the current search's results, and a
  // chart picked under an earlier search must still be added.
  const [selectedCharts, setSelectedCharts] = useState<TAppChart[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const nameContains = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);

  const { charts, isPending, isError, error, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useCharts({
      workspaceId,
      limit: CHARTS_PAGE_SIZE,
      nameContains: nameContains || undefined,
      enabled: open,
    });

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSearch("");
      setSelectedCharts([]);
    }
    onOpenChange(next);
  };

  const toggleChart = (chart: TAppChart, checked: boolean) =>
    setSelectedCharts((current) => {
      const others = current.filter((selected) => selected.id !== chart.id);
      return checked ? [...others, chart] : others;
    });

  // Picked charts go into the edit's draft, placed on the current page; the dashboard's save adds them.
  const handleAdd = () => {
    if (selectedCharts.length === 0) return;
    onPick(selectedCharts);
    handleOpenChange(false);
  };

  // A chart created from here joins the draft too, read back so the page can draw it.
  const handleCreated = async (chartId?: string) => {
    handleOpenChange(false);
    if (!chartId) return;
    setIsAdding(true);
    try {
      onPick([await getChart(chartId)]);
    } catch (error) {
      toast.error(getChartApiErrorMessage(error, t("workspace.analysis.dashboards.charts_add_failed")));
    } finally {
      setIsAdding(false);
    }
  };

  const renderCharts = () => {
    if (isPending) {
      return (
        <div className="flex items-center justify-center py-6">
          <LoadingSpinner />
          <span className="sr-only">{t("common.loading")}</span>
        </div>
      );
    }
    if (isError) {
      return (
        <ListLoadError
          title={t("workspace.analysis.dashboards.charts_load_failed")}
          error={error}
          onRetry={refetch}
        />
      );
    }
    if (charts.length === 0) {
      return (
        <p className="py-6 text-center text-sm text-slate-500">
          {nameContains
            ? t("workspace.analysis.dashboards.no_charts_match_search")
            : t("workspace.analysis.charts.no_charts_found")}
        </p>
      );
    }

    return (
      <ul className="max-h-72 space-y-1 overflow-y-auto">
        {charts.map((chart) => {
          const isOnDashboard = placedChartIds.has(chart.id);
          const checkboxId = `add-chart-${chart.id}`;
          return (
            <li key={chart.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-slate-50">
              <Checkbox
                id={checkboxId}
                checked={isOnDashboard || selectedCharts.some((selected) => selected.id === chart.id)}
                disabled={isOnDashboard || isAdding}
                onCheckedChange={(checked) => toggleChart(chart, checked === true)}
              />
              <label
                htmlFor={checkboxId}
                className={
                  isOnDashboard ? "text-sm text-slate-400" : "cursor-pointer text-sm text-slate-800"
                }>
                {chart.name}
                {isOnDashboard && (
                  <span className="ml-2 text-xs">
                    ({t("workspace.analysis.dashboards.already_on_this_page")})
                  </span>
                )}
              </label>
            </li>
          );
        })}
        <li>
          <LoadMoreOnScroll
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            fetchNextPage={fetchNextPage}
          />
        </li>
      </ul>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("common.add_charts")}</DialogTitle>
          <DialogDescription>{t("common.add_existing_chart_description")}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3 p-1">
          <Input
            type="search"
            aria-label={t("common.search_charts")}
            placeholder={t("common.search_charts")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            maxLength={255}
          />
          {renderCharts()}
        </DialogBody>
        <DialogFooter className="sm:justify-between">
          <CreateChartButton
            workspaceId={workspaceId}
            directories={directories}
            label={t("workspace.analysis.dashboards.create_new_chart")}
            onSuccess={(chartId) => void handleCreated(chartId)}
            buttonProps={{ variant: "secondary", size: "default", disabled: isAdding }}
            isAIAvailable={isAIAvailable}
            aiUnavailableReason={aiUnavailableReason}
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isAdding}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleAdd} loading={isAdding} disabled={selectedCharts.length === 0 || isAdding}>
              {selectedCharts.length > 0
                ? t("workspace.analysis.dashboards.add_count_charts", { count: selectedCharts.length })
                : t("common.add")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
