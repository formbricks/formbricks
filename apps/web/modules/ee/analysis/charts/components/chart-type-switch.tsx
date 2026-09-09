"use client";

import { useId } from "react";
import { useTranslation } from "react-i18next";
import { getChartTypes } from "@/modules/ee/analysis/charts/lib/chart-types";
import type { TChartType } from "@/modules/ee/analysis/types/analysis";
import { Label } from "@/modules/ui/components/label";
import { OptionsSwitch } from "@/modules/ui/components/options-switch";

interface ChartTypeSwitchProps {
  selectedChartType: TChartType;
  onChartTypeSelect: (type: TChartType) => void;
}

/**
 * How the chart is drawn, not what it reports on — so this rides on the preview next to the other
 * view controls rather than gating the builder from a card of its own. It is also the same switch
 * the display settings below the chart use, because both answer "how should this look".
 */
export function ChartTypeSwitch({ selectedChartType, onChartTypeSelect }: Readonly<ChartTypeSwitchProps>) {
  const { t } = useTranslation();
  // The switch is a fieldset, which a plain <label htmlFor> cannot name; point it at this instead.
  const labelId = useId();
  const chartTypes = getChartTypes(t);

  return (
    <>
      <Label id={labelId} className="sr-only">
        {t("workspace.analysis.charts.configure_type_label")}
      </Label>
      <OptionsSwitch
        aria-labelledby={labelId}
        options={chartTypes.map((chart) => ({
          value: chart.id,
          label: chart.label,
          icon: <chart.icon className="size-4" strokeWidth={1.5} />,
        }))}
        currentOption={selectedChartType}
        handleOptionChange={(value) => onChartTypeSelect(value as TChartType)}
      />
    </>
  );
}
