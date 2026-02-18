"use client";

import { MultiSelect } from "@/modules/ui/components/multi-select";
import { FEEDBACK_FIELDS } from "@/modules/ee/analysis/lib/schema-definition";

interface DimensionsPanelProps {
  selectedDimensions: string[];
  onDimensionsChange: (dimensions: string[]) => void;
}

export function DimensionsPanel({ selectedDimensions, onDimensionsChange }: DimensionsPanelProps) {
  const dimensionOptions = FEEDBACK_FIELDS.dimensions.map((d) => ({
    value: d.id,
    label: `${d.label}${d.description ? ` - ${d.description}` : ""}`,
  }));

  return (
    <div className="space-y-4">
      <h3 className="font-medium text-gray-900">Dimensions</h3>

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Group By</label>
        <MultiSelect
          options={dimensionOptions}
          value={selectedDimensions}
          onChange={onDimensionsChange}
          placeholder="Select dimensions to group by..."
        />
        <p className="text-xs text-gray-500">
          Select dimensions to break down your data. The order matters for multi-dimensional charts.
        </p>
      </div>
    </div>
  );
}
