"use client";

import type { TFunction } from "i18next";
import {
  AreaChartIcon,
  ChartBarIcon,
  ChartBarStackedIcon,
  ChartColumnBigIcon,
  ChartColumnIcon,
  ChartPieIcon,
  HashIcon,
  LineChartIcon,
  PercentIcon,
  RectangleHorizontalIcon,
  SigmaIcon,
} from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { TChartConfig, TChartQuery } from "@formbricks/types/analysis";
import {
  type TAreaDisplay,
  type TBarOrientation,
  type TPieDisplay,
  resolveChartDisplay,
  supportsAreaDisplay,
  supportsBarLayout,
  supportsBarOrientation,
  supportsEmptyValues,
  supportsMatrixDisplay,
  supportsPieDisplay,
} from "@/modules/ee/analysis/charts/lib/chart-display";
import { getChartGrouping, hasStackableSeries } from "@/modules/ee/analysis/charts/lib/chart-series";
import { type TMatrixCellValue, resolveMatrixDisplay } from "@/modules/ee/analysis/charts/lib/matrix-pivot";
import type { TChartType } from "@/modules/ee/analysis/types/analysis";
import { ControlBar, type TControlBarItem } from "@/modules/ui/components/control-bar";
import { Label } from "@/modules/ui/components/label";
import { OptionsSwitch } from "@/modules/ui/components/options-switch";

interface ChartDisplaySettingsProps {
  chartType: TChartType | undefined;
  config: TChartConfig;
  onChange: (config: TChartConfig) => void;
  /** The chart's query, so settings that only apply to some groupings (bar layout, empty values)
   * are offered only when they would change something. */
  query?: TChartQuery;
}

/** What a matrix cell prints; its on/off settings live in the shared control bar. */
function MatrixDisplaySettings({
  config,
  onChange,
}: Readonly<{ config: TChartConfig; onChange: (config: TChartConfig) => void }>) {
  const { t } = useTranslation();
  const { cellValue } = resolveMatrixDisplay(config);
  const cellValueLabelId = useId();

  return (
    <div className="flex min-w-0 items-center gap-3">
      <Label id={cellValueLabelId} className="shrink-0 text-xs text-slate-500">
        {t("workspace.analysis.charts.matrix_cell_value")}
      </Label>
      <div className="min-w-0">
        <OptionsSwitch
          labelDisplay="active"
          aria-labelledby={cellValueLabelId}
          options={[
            {
              value: "percent",
              label: t("workspace.analysis.charts.matrix_cell_value_percent"),
              icon: <PercentIcon className="size-4" />,
            },
            {
              value: "count",
              label: t("workspace.analysis.charts.matrix_cell_value_count"),
              icon: <HashIcon className="size-4" />,
            },
            {
              value: "both",
              label: t("workspace.analysis.charts.matrix_cell_value_both"),
              icon: <SigmaIcon className="size-4" />,
            },
          ]}
          currentOption={cellValue}
          handleOptionChange={(value) => onChange({ ...config, matrixCellValue: value as TMatrixCellValue })}
        />
      </div>
    </div>
  );
}

/** The on/off settings a matrix adds to the control bar: tint, totals, and which way round. */
const getMatrixToggleItems = (
  config: TChartConfig,
  onChange: (config: TChartConfig) => void,
  t: TFunction
): TControlBarItem[] => {
  const { colorScale, showTotals, transpose } = resolveMatrixDisplay(config);
  return [
    {
      value: "matrixColorScale",
      label: t("workspace.analysis.charts.matrix_color_scale"),
      checked: colorScale,
      onCheckedChange: (checked) => onChange({ ...config, matrixColorScale: checked }),
    },
    {
      value: "matrixShowTotals",
      label: t("workspace.analysis.charts.matrix_show_totals"),
      checked: showTotals,
      onCheckedChange: (checked) => onChange({ ...config, matrixShowTotals: checked }),
    },
    {
      value: "matrixTranspose",
      label: t("workspace.analysis.charts.matrix_transpose"),
      checked: transpose,
      onCheckedChange: (checked) => onChange({ ...config, matrixTranspose: checked }),
    },
  ];
};

/**
 * Display settings saved with the chart, so they apply wherever it renders (preview, chart
 * list, dashboard widget) rather than only to the preview. Settings that the current chart
 * type doesn't support are hidden instead of shown inert.
 *
 * Rendered as a strip under the chart rather than as a card of its own: these only change how the
 * chart looks, so their effect is visible in the same glance, and a third card below the preview
 * was the one thing in this dialog nobody found without scrolling.
 */
export function ChartDisplaySettings({
  chartType,
  config,
  onChange,
  query,
}: Readonly<ChartDisplaySettingsProps>) {
  const { t } = useTranslation();
  const { barOrientation, pieDisplay, areaDisplay, stacked, showEmptyValues } = resolveChartDisplay(config);
  const showBarOrientation = supportsBarOrientation(chartType);
  const showPieDisplay = supportsPieDisplay(chartType);
  const showAreaDisplay = supportsAreaDisplay(chartType);
  const showMatrixDisplay = supportsMatrixDisplay(chartType);
  // Without a query (callers that predate it) both are offered whenever the type supports them.
  const showBarLayout = supportsBarLayout(chartType) && (!query || hasStackableSeries(query));
  const showEmptyValuesToggle =
    supportsEmptyValues(chartType) && (!query || getChartGrouping(query).dimensionKeys.length > 0);
  // Generated rather than hardcoded: two of these panels on one page would otherwise share ids.
  const barOrientationLabelId = useId();
  const barLayoutLabelId = useId();
  const pieDisplayLabelId = useId();
  const areaDisplayLabelId = useId();

  const toggleItems: TControlBarItem[] = [
    ...(showMatrixDisplay ? getMatrixToggleItems(config, onChange, t) : []),
    ...(showEmptyValuesToggle
      ? [
          {
            value: "showEmptyValues",
            label: t("workspace.analysis.charts.show_empty_values"),
            checked: showEmptyValues,
            onCheckedChange: (checked: boolean) => onChange({ ...config, showEmptyValues: checked }),
          },
        ]
      : []),
  ];

  // For a chart type with no applicable setting the strip would be an empty band.
  if (
    !showBarOrientation &&
    !showPieDisplay &&
    !showAreaDisplay &&
    !showMatrixDisplay &&
    !showBarLayout &&
    !showEmptyValuesToggle
  )
    return null;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      {showMatrixDisplay && <MatrixDisplaySettings config={config} onChange={onChange} />}
      {showAreaDisplay && (
        <div className="flex min-w-0 items-center gap-3">
          <Label id={areaDisplayLabelId} className="shrink-0 text-xs text-slate-500">
            {t("workspace.analysis.charts.area_display")}
          </Label>
          <div className="min-w-0">
            <OptionsSwitch
              labelDisplay="active"
              aria-labelledby={areaDisplayLabelId}
              options={[
                {
                  value: "filled",
                  label: t("workspace.analysis.charts.area_display_filled"),
                  icon: <AreaChartIcon className="size-4" />,
                },
                {
                  value: "line",
                  label: t("workspace.analysis.charts.area_display_line"),
                  icon: <LineChartIcon className="size-4" />,
                },
              ]}
              currentOption={areaDisplay}
              handleOptionChange={(value) => onChange({ ...config, areaDisplay: value as TAreaDisplay })}
            />
          </div>
        </div>
      )}
      {showPieDisplay && (
        <div className="flex min-w-0 items-center gap-3">
          <Label id={pieDisplayLabelId} className="shrink-0 text-xs text-slate-500">
            {t("workspace.analysis.charts.pie_display")}
          </Label>
          <div className="min-w-0">
            <OptionsSwitch
              labelDisplay="active"
              aria-labelledby={pieDisplayLabelId}
              options={[
                {
                  value: "pie",
                  label: t("workspace.analysis.charts.pie_display_pie"),
                  icon: <ChartPieIcon className="size-4" />,
                },
                {
                  value: "breakdown",
                  label: t("workspace.analysis.charts.pie_display_breakdown"),
                  icon: <RectangleHorizontalIcon className="size-4" />,
                },
              ]}
              currentOption={pieDisplay}
              handleOptionChange={(value) => onChange({ ...config, pieDisplay: value as TPieDisplay })}
            />
          </div>
        </div>
      )}
      {showBarOrientation && (
        <div className="flex min-w-0 items-center gap-3">
          <Label id={barOrientationLabelId} className="shrink-0 text-xs text-slate-500">
            {t("workspace.analysis.charts.bar_direction")}
          </Label>
          <div className="min-w-0">
            <OptionsSwitch
              labelDisplay="active"
              aria-labelledby={barOrientationLabelId}
              options={[
                {
                  value: "vertical",
                  label: t("workspace.analysis.charts.vertical_bars"),
                  icon: <ChartColumnIcon className="size-4" />,
                },
                {
                  value: "horizontal",
                  label: t("workspace.analysis.charts.horizontal_bars"),
                  icon: <ChartBarIcon className="size-4" />,
                },
              ]}
              currentOption={barOrientation}
              handleOptionChange={(value) =>
                onChange({ ...config, barOrientation: value as TBarOrientation })
              }
            />
          </div>
        </div>
      )}
      {showBarLayout && (
        <div className="flex min-w-0 items-center gap-3">
          <Label id={barLayoutLabelId} className="shrink-0 text-xs text-slate-500">
            {t("workspace.analysis.charts.bar_layout")}
          </Label>
          <div className="min-w-0">
            <OptionsSwitch
              labelDisplay="active"
              aria-labelledby={barLayoutLabelId}
              options={[
                {
                  value: "stacked",
                  label: t("workspace.analysis.charts.bar_layout_stacked"),
                  icon: <ChartBarStackedIcon className="size-4" />,
                },
                {
                  value: "grouped",
                  label: t("workspace.analysis.charts.bar_layout_side_by_side"),
                  icon: <ChartColumnBigIcon className="size-4" />,
                },
              ]}
              currentOption={stacked ? "stacked" : "grouped"}
              handleOptionChange={(value) => onChange({ ...config, stacked: value === "stacked" })}
            />
          </div>
        </div>
      )}
      <ControlBar items={toggleItems} />
    </div>
  );
}
