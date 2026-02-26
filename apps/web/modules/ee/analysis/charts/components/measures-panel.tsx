"use client";

import { Plus, TrashIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CustomMeasure } from "@/modules/ee/analysis/lib/query-builder";
import { FEEDBACK_FIELDS } from "@/modules/ee/analysis/lib/schema-definition";
import { AdvancedOptionToggle } from "@/modules/ui/components/advanced-option-toggle";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { MultiSelect } from "@/modules/ui/components/multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";

interface MeasuresPanelProps {
  selectedMeasures: string[];
  customMeasures: CustomMeasure[];
  customAggregationsOpen: boolean;
  onCustomAggregationsOpenChange: (open: boolean) => void;
  onMeasuresChange: (measures: string[]) => void;
  onCustomMeasuresChange: (measures: CustomMeasure[]) => void;
  hideTitle?: boolean;
}

const measureOptions = FEEDBACK_FIELDS.measures.map((m) => ({
  value: m.id,
  label: [m.label, m.description].filter(Boolean).join(" - "),
}));

const dimensionOptions = FEEDBACK_FIELDS.dimensions
  .filter((d) => d.type === "number")
  .map((d) => ({
    value: d.id,
    label: d.label,
  }));

const aggregationOptions = FEEDBACK_FIELDS.customAggregations.map((agg) => ({
  value: agg,
  label: agg.charAt(0).toUpperCase() + agg.slice(1),
}));

export function MeasuresPanel({
  selectedMeasures,
  customMeasures,
  customAggregationsOpen,
  onCustomAggregationsOpenChange,
  onMeasuresChange,
  onCustomMeasuresChange,
  hideTitle = false,
}: Readonly<MeasuresPanelProps>) {
  const { t } = useTranslation();

  const handleAddCustomMeasure = () => {
    onCustomMeasuresChange([
      ...customMeasures,
      {
        id: `measure-${crypto.randomUUID()}`,
        field: dimensionOptions[0]?.value || "",
        aggregation: "avg",
      },
    ]);
  };

  const handleRemoveCustomMeasure = (index: number) => {
    onCustomMeasuresChange(customMeasures.filter((_, i) => i !== index));
  };

  const handleUpdateCustomMeasure = (index: number, updates: Partial<CustomMeasure>) => {
    const updated = [...customMeasures];
    updated[index] = { ...updated[index], ...updates };
    onCustomMeasuresChange(updated);
  };

  return (
    <div className="w-full space-y-2">
      {!hideTitle && (
        <h3 className="text-md font-semibold text-gray-900">{t("environments.analysis.charts.measures")}</h3>
      )}
      <div className="space-y-2">
        {/* Predefined Measures */}
        <div className="space-y-2">
          <label className="text-sm">{t("environments.analysis.charts.predefined_measures")}</label>
          <MultiSelect
            options={measureOptions}
            value={selectedMeasures}
            onChange={(selected) => onMeasuresChange(selected)}
            placeholder={t("environments.analysis.charts.select_measures")}
          />
        </div>

        {/* Custom Aggregations */}
        <AdvancedOptionToggle
          isChecked={customAggregationsOpen}
          onToggle={onCustomAggregationsOpenChange}
          htmlId="chart-custom-aggregations-toggle"
          title={t("environments.analysis.charts.custom_aggregations")}
          description={t("environments.analysis.charts.custom_aggregations_toggle_description")}
          customContainerClass="mt-2 px-0"
          childrenContainerClass="flex-col gap-3 p-4"
          childBorder>
          <div className="w-full space-y-2">
            {customMeasures.map((measure, index) => (
              <div
                key={measure.id ?? `custom-measure-${index}`}
                className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-3">
                <Select
                  value={measure.field}
                  onValueChange={(value) => handleUpdateCustomMeasure(index, { field: value })}>
                  <SelectTrigger className="w-[200px] bg-white">
                    <SelectValue placeholder={t("environments.analysis.charts.select_field")} />
                  </SelectTrigger>
                  <SelectContent>
                    {dimensionOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={measure.aggregation}
                  onValueChange={(value) => handleUpdateCustomMeasure(index, { aggregation: value })}>
                  <SelectTrigger className="w-[150px] bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {aggregationOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  placeholder={t("environments.analysis.charts.alias_optional")}
                  value={measure.alias || ""}
                  onChange={(e) => handleUpdateCustomMeasure(index, { alias: e.target.value })}
                  className="flex-1 bg-white"
                />

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveCustomMeasure(index)}
                  className="h-8 w-8">
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {customMeasures.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddCustomMeasure}
                className="h-8">
                <Plus className="h-4 w-4" />
                {t("environments.analysis.charts.add_custom_measure")}
              </Button>
            )}
          </div>
        </AdvancedOptionToggle>
      </div>
    </div>
  );
}
