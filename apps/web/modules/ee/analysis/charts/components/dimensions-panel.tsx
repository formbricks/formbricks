"use client";

import { useTranslation } from "react-i18next";
import { EmbeddedFieldRenameButton } from "@/modules/ee/analysis/charts/components/embedded-field-rename-button";
import { getEmbeddedFieldDisplayName } from "@/modules/ee/analysis/lib/embedded-field-label-limits";
import type { TEmbeddedChartField } from "@/modules/ee/analysis/lib/field-catalog";
import {
  FEEDBACK_FIELDS,
  VALUE_ID_DIMENSION_ID,
  VALUE_TEXT_DIMENSION_ID,
  getTranslatedFieldDescription,
  getTranslatedFieldLabel,
} from "@/modules/ee/analysis/lib/schema-definition";
import { AiIcon } from "@/modules/ui/components/ai";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Label } from "@/modules/ui/components/label";
import { MultiSelect } from "@/modules/ui/components/multi-select";

interface DimensionsPanelProps {
  selectedDimensions: string[];
  onDimensionsChange: (dimensions: string[]) => void;
  hideTitle?: boolean;
  /** A matrix reads its groupings positionally — the first is the rows, the second the columns. */
  isMatrix?: boolean;
  /** The dataset's embedded-data keys, offered as groupings under their own names (ENG-6893). */
  embeddedFields?: readonly TEmbeddedChartField[];
  /**
   * With a workspace, a chosen imported field's chip carries a ✎ that renames the key across the workspace.
   * Built-in fields keep their translated names.
   */
  workspaceId?: string;
  /** Called once an imported field is renamed, e.g. to re-run the preview so its legend shows the name. */
  onEmbeddedFieldRenamed?: () => void;
}

export function DimensionsPanel({
  selectedDimensions,
  onDimensionsChange,
  hideTitle = false,
  isMatrix = false,
  embeddedFields = [],
  workspaceId,
  onEmbeddedFieldRenamed,
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
    icon: d.isGenerated ? <AiIcon /> : undefined,
    // Headed only beside a second group, as the filter field picker does.
    group: embeddedFields.length > 0 ? t("workspace.analysis.charts.dimensions") : undefined,
  }));
  // Under one "Embedded data" heading, as the filter field picker groups them (U15).
  // Listed under the workspace's name for a key, when it renamed it; the key itself is the description.
  const embeddedOptions = embeddedFields.map((field) => ({
    value: field.name,
    label: getEmbeddedFieldDisplayName(field),
    description: field.label === undefined ? undefined : field.key,
    group: t("workspace.analysis.charts.embedded_data"),
    badgeAction: workspaceId ? (
      <EmbeddedFieldRenameButton workspaceId={workspaceId} field={field} onRenamed={onEmbeddedFieldRenamed} />
    ) : undefined,
  }));
  const fieldLabel = (id: string) => {
    const embedded = embeddedFields.find((field) => field.name === id);
    return embedded ? getEmbeddedFieldDisplayName(embedded) : getTranslatedFieldLabel(id, t);
  };

  return (
    <div className="w-full space-y-2">
      {!hideTitle && (
        <h3 className="text-md font-semibold text-gray-900">{t("workspace.analysis.charts.dimensions")}</h3>
      )}
      <div className="space-y-3">
        <Label className="text-sm">{t("workspace.analysis.charts.group_by")}</Label>
        <MultiSelect
          options={[...dimensionOptions, ...embeddedOptions]}
          value={selectedDimensions}
          onChange={onDimensionsChange}
          placeholder={t("workspace.analysis.charts.select_dimensions")}
        />
        {/*
          Helper text, not an alert: it explains the field rather than warning about it, and a
          small Alert truncates to one line — which in a narrow column loses the half that matters.
        */}
        <p className="text-xs text-slate-500">
          {isMatrix
            ? t("workspace.analysis.charts.matrix_group_by_description")
            : t("workspace.analysis.charts.group_by_description")}
        </p>
        {isMatrix && selectedDimensions.length > 0 && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md bg-slate-50 px-3 py-2 text-xs">
            <dt className="text-slate-500">{t("workspace.analysis.charts.matrix_rows")}</dt>
            <dd className="truncate text-slate-900">
              {selectedDimensions[0] ? fieldLabel(selectedDimensions[0]) : "\u2013"}
            </dd>
            <dt className="text-slate-500">{t("workspace.analysis.charts.matrix_columns")}</dt>
            <dd className="truncate text-slate-900">
              {selectedDimensions[1] ? fieldLabel(selectedDimensions[1]) : "\u2013"}
            </dd>
          </dl>
        )}
        {suggestsOptionGrouping && (
          // Full size so it wraps: this one is several sentences, and truncated it says nothing.
          <Alert variant="warning" alertRole="status">
            <AlertDescription>{t("workspace.analysis.charts.prefer_option_grouping")}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
