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

  // For a chart type with no applicable setting the section would be a heading with nothing under it.
  if (!showBarOrientation && !showPieDisplay && !showAreaDisplay) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-xs">
      <h3 className="mb-4 font-semibold text-gray-900">
        {t("workspace.analysis.charts.chart_display_settings")}
      </h3>

      <div className="flex flex-col gap-4">
        {showAreaDisplay && (
          <div className="flex flex-col gap-2">
            <Label id={areaDisplayLabelId}>{t("workspace.analysis.charts.area_display")}</Label>
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
        )}
        {showPieDisplay && (
          <div className="flex flex-col gap-2">
            <Label id={pieDisplayLabelId}>{t("workspace.analysis.charts.pie_display")}</Label>
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
        )}
        {showBarOrientation && (
          <div className="flex flex-col gap-2">
            <Label id={barOrientationLabelId}>{t("workspace.analysis.charts.bar_direction")}</Label>
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
        )}
      </div>
    </div>
  );
}
