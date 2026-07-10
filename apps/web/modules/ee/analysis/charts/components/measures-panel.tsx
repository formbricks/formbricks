"use client";

import { Gauge, Hash, Shapes, Sigma } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  FEEDBACK_FIELDS,
  MEASURE_GROUP_ORDER,
  type TMeasureGroup,
  getTranslatedFieldLabel,
} from "@/modules/ee/analysis/lib/schema-definition";
import { Label } from "@/modules/ui/components/label";
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

  const groupMeta: Record<TMeasureGroup, { label: string; icon: ReactNode }> = {
    score: { label: t("workspace.analysis.charts.measure_group_score"), icon: <Gauge className="size-3" /> },
    average: {
      label: t("workspace.analysis.charts.measure_group_average"),
      icon: <Sigma className="size-3" />,
    },
    count: { label: t("workspace.analysis.charts.measure_group_count"), icon: <Hash className="size-3" /> },
    other: {
      label: t("workspace.analysis.charts.measure_group_other"),
      icon: <Shapes className="size-3" />,
    },
  };

  // Order measures by section (Score → Average → Count → Other); each option carries its section
  // heading + icon so the dropdown renders grouped, scannable sections.
  const measureOptions = MEASURE_GROUP_ORDER.flatMap((group) =>
    FEEDBACK_FIELDS.measures
      .filter((m) => m.group === group)
      .map((m) => ({
        value: m.id,
        label: getTranslatedFieldLabel(m.id, t),
        description: m.description,
        group: groupMeta[group].label,
        groupIcon: groupMeta[group].icon,
      }))
  );

  return (
    <div className="w-full space-y-2">
      {!hideTitle && (
        <h3 className="text-md font-semibold text-gray-900">{t("workspace.analysis.charts.measures")}</h3>
      )}
      <div className="flex flex-col gap-2">
        <Label className="text-sm">{t("workspace.analysis.charts.predefined_measures")}</Label>
        <MultiSelect
          options={measureOptions}
          value={selectedMeasures}
          onChange={(selected) => onMeasuresChange(selected)}
          placeholder={t("workspace.analysis.charts.select_measures")}
        />
      </div>
    </div>
  );
}
