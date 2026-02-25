"use client";

import { useTranslation } from "react-i18next";
import { FEEDBACK_FIELDS } from "@/modules/ee/analysis/lib/schema-definition";
import { MultiSelect } from "@/modules/ui/components/multi-select";

interface DimensionsPanelProps {
  selectedDimensions: string[];
  onDimensionsChange: (dimensions: string[]) => void;
}

export function DimensionsPanel({ selectedDimensions, onDimensionsChange }: Readonly<DimensionsPanelProps>) {
  const { t } = useTranslation();
  const dimensionOptions = FEEDBACK_FIELDS.dimensions.map((d) => ({
    value: d.id,
    label: [d.label, d.description].filter(Boolean).join(" - "),
  }));

  return (
    <div className="space-y-2">
      <h3 className="text-md font-semibold text-gray-900">{t("environments.analysis.charts.dimensions")}</h3>

      <div className="space-y-2">
        <label className="text-sm">{t("environments.analysis.charts.group_by")}</label>
        <MultiSelect
          options={dimensionOptions}
          value={selectedDimensions}
          onChange={onDimensionsChange}
          placeholder={t("environments.analysis.charts.select_measures")}
        />
        <p className="text-sm text-gray-500">{t("environments.analysis.charts.group_by_description")}</p>
      </div>
    </div>
  );
}
