"use client";

import {
  AreaChartIcon,
  ChartBarIcon,
  ChartColumnIcon,
  ChartPieIcon,
  LineChartIcon,
  RectangleHorizontalIcon,
} from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { TChartConfig } from "@formbricks/types/analysis";
import {
  type TAreaDisplay,
  type TBarOrientation,
  type TPieDisplay,
  resolveChartDisplay,
  supportsAreaDisplay,
  supportsBarOrientation,
  supportsPieDisplay,
} from "@/modules/ee/analysis/charts/lib/chart-display";
import type { TChartType } from "@/modules/ee/analysis/types/analysis";
import { Label } from "@/modules/ui/components/label";
import { OptionsSwitch } from "@/modules/ui/components/options-switch";

interface ChartDisplaySettingsProps {
  chartType: TChartType | undefined;
  config: TChartConfig;
  onChange: (config: TChartConfig) => void;
}

/**
 * Display settings saved with the chart, so they apply wherever it renders (preview, chart
 * list, dashboard widget) rather than only to the preview. Settings that the current chart
 * type doesn't support are hidden instead of shown inert.
 *
 * Rendered as a strip under the chart rather than as a card of its own: these only change how the
 * chart looks, so their effect is visible in the same glance, and a third card below the preview
 * was the one thing in this dialog nobody found without scrolling.
 */
export function ChartDisplaySettings({ chartType, config, onChange }: Readonly<ChartDisplaySettingsProps>) {
  const { t } = useTranslation();
  const { barOrientation, pieDisplay, areaDisplay } = resolveChartDisplay(config);
  const showBarOrientation = supportsBarOrientation(chartType);
  const showPieDisplay = supportsPieDisplay(chartType);
  const showAreaDisplay = supportsAreaDisplay(chartType);
  // Generated rather than hardcoded: two of these panels on one page would otherwise share ids.
  const barOrientationLabelId = useId();
  const pieDisplayLabelId = useId();
  const areaDisplayLabelId = useId();

  // For a chart type with no applicable setting the strip would be an empty band.
  if (!showBarOrientation && !showPieDisplay && !showAreaDisplay) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      {showAreaDisplay && (
        <div className="flex min-w-0 items-center gap-3">
          <Label id={areaDisplayLabelId} className="shrink-0 text-xs text-slate-500">
            {t("workspace.analysis.charts.area_display")}
          </Label>
          <div className="min-w-0">
            <OptionsSwitch
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
    </div>
  );
}
