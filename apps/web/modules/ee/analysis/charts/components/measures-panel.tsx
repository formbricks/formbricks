"use client";

import { useTranslation } from "react-i18next";
import { FEEDBACK_FIELDS, getTranslatedFieldLabel } from "@/modules/ee/analysis/lib/schema-definition";
import { MultiSelect } from "@/modules/ui/components/multi-select";

interface MeasuresPanelProps {
  selectedMeasures: string[];
  onMeasuresChange: (measures: string[]) => void;
  hideTitle?: boolean;
}

export function MeasuresPanel({
  selectedMeasures,
  onMeasuresChange,
  hideTitle = false,
}: Readonly<MeasuresPanelProps>) {
  const { t } = useTranslation();

  const measureOptions = FEEDBACK_FIELDS.measures.map((m) => ({
    value: m.id,
    label: [getTranslatedFieldLabel(m.id, t), m.description].filter(Boolean).join(" - "),
  }));

  return (
    <div className="w-full space-y-2">
      {!hideTitle && (
        <h3 className="text-md font-semibold text-gray-900">{t("environments.analysis.charts.measures")}</h3>
      )}
      <div className="space-y-2">
        <label className="text-sm">{t("environments.analysis.charts.predefined_measures")}</label>
        <MultiSelect
          options={measureOptions}
          value={selectedMeasures}
          onChange={(selected) => onMeasuresChange(selected)}
          placeholder={t("environments.analysis.charts.select_measures")}
        />
      </div>
    </div>
  );
}
