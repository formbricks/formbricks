"use client";

import { useTranslation } from "react-i18next";
import { FEEDBACK_FIELDS, getTranslatedFieldLabel } from "@/modules/ee/analysis/lib/schema-definition";
import { Alert, AlertTitle } from "@/modules/ui/components/alert";
import { Label } from "@/modules/ui/components/label";
import { MultiSelect } from "@/modules/ui/components/multi-select";

interface DimensionsPanelProps {
  selectedDimensions: string[];
  onDimensionsChange: (dimensions: string[]) => void;
  hideTitle?: boolean;
}

export function DimensionsPanel({
  selectedDimensions,
  onDimensionsChange,
  hideTitle = false,
}: Readonly<DimensionsPanelProps>) {
  const { t } = useTranslation();

  const dimensionOptions = FEEDBACK_FIELDS.dimensions.map((d) => ({
    value: d.id,
    label: [getTranslatedFieldLabel(d.id, t), d.description].filter(Boolean).join(" - "),
  }));

  return (
    <div className="w-full space-y-2">
      {!hideTitle && (
        <h3 className="text-md font-semibold text-gray-900">
          {t("environments.analysis.charts.dimensions")}
        </h3>
      )}
      <div className="space-y-2">
        <Label className="text-sm">{t("environments.analysis.charts.group_by")}</Label>
        <MultiSelect
          options={dimensionOptions}
          value={selectedDimensions}
          onChange={onDimensionsChange}
          placeholder={t("environments.analysis.charts.select_dimensions")}
        />
        <Alert variant="info" size="small">
          <AlertTitle>{t("environments.analysis.charts.group_by_description")}</AlertTitle>
        </Alert>
      </div>
    </div>
  );
}
