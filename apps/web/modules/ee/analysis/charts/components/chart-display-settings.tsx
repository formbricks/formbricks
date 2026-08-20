"use client";

import { ChartBarIcon, ChartColumnIcon } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { TChartConfig } from "@formbricks/types/analysis";
import {
  type TBarOrientation,
  resolveChartDisplay,
  supportsBarOrientation,
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
  const { barOrientation } = resolveChartDisplay(config);
  const showBarOrientation = supportsBarOrientation(chartType);
  // Generated rather than hardcoded: two of these panels on one page would otherwise share ids.
  const barOrientationLabelId = useId();

  // Bar direction is the only setting so far, so for every other chart type the section would be a
  // heading with nothing under it.
  if (!showBarOrientation) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-xs">
      <h3 className="mb-4 font-semibold text-gray-900">
        {t("workspace.analysis.charts.chart_display_settings")}
      </h3>

      <div className="flex flex-col gap-4">
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
            handleOptionChange={(value) => onChange({ ...config, barOrientation: value as TBarOrientation })}
          />
        </div>
      </div>
    </div>
  );
}
