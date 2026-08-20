"use client";

import { SparklesIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  FEEDBACK_FIELDS,
  VALUE_ID_DIMENSION_ID,
  VALUE_TEXT_DIMENSION_ID,
  getTranslatedFieldDescription,
  getTranslatedFieldLabel,
} from "@/modules/ee/analysis/lib/schema-definition";
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

  // Grouping a choice question by its answer text is the trap this hint exists for: it looks like
  // the natural pick, then splits one option into several buckets as soon as a translated label, an
  // edited label or a free-text "other" answer shows up. Nudge rather than rewrite the query, so a
  // chart never silently regroups itself under someone.
  const suggestsOptionGrouping =
    selectedDimensions.includes(VALUE_TEXT_DIMENSION_ID) &&
    !selectedDimensions.includes(VALUE_ID_DIMENSION_ID);

  const dimensionOptions = FEEDBACK_FIELDS.dimensions.map((d) => ({
    value: d.id,
    label: getTranslatedFieldLabel(d.id, t),
    description: getTranslatedFieldDescription(d.id, d.description, t),
    icon: d.isGenerated ? <SparklesIcon className="size-4 text-slate-500" aria-hidden="true" /> : undefined,
  }));

  return (
    <div className="w-full space-y-2">
      {!hideTitle && (
        <h3 className="text-md font-semibold text-gray-900">{t("workspace.analysis.charts.dimensions")}</h3>
      )}
      <div className="space-y-3">
        <Label className="text-sm">{t("workspace.analysis.charts.group_by")}</Label>
        <MultiSelect
          options={dimensionOptions}
          value={selectedDimensions}
          onChange={onDimensionsChange}
          placeholder={t("workspace.analysis.charts.select_dimensions")}
        />
        <Alert variant="info" size="small" role="status">
          <AlertTitle>{t("workspace.analysis.charts.group_by_description")}</AlertTitle>
        </Alert>
        {suggestsOptionGrouping && (
          <Alert variant="warning" role="status">
            <AlertTitle>{t("workspace.analysis.charts.prefer_option_grouping")}</AlertTitle>
          </Alert>
        )}
      </div>
    </div>
  );
}
