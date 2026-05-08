"use client";

import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TConnectorType, THubFieldType, ZHubFieldType } from "@formbricks/types/connector";
import { CSV_FIELD_GROUPS, CSV_TARGET_FIELDS, TFieldMapping, TSourceField, TTargetField } from "../types";
import { TMappingConfidence, routeResponseValueTarget } from "../utils";
import { FormTargetField, TAutoMapState } from "./mapping-field";

interface MappingUIProps {
  sourceFields: TSourceField[];
  mappings: TFieldMapping[];
  onMappingsChange: (mappings: TFieldMapping[]) => void;
  connectorType: TConnectorType;
  confidenceByTargetId?: Record<string, TMappingConfidence>;
  sampleRow?: Record<string, string>;
}

const toAutoMapState = (confidence?: TMappingConfidence): TAutoMapState | undefined => {
  if (confidence === "high" || confidence === "medium" || confidence === "low") return confidence;
  return undefined;
};

export function MappingUI({
  sourceFields,
  mappings,
  onMappingsChange,
  connectorType,
  confidenceByTargetId,
  sampleRow,
}: MappingUIProps) {
  switch (connectorType) {
    case "csv":
      return (
        <CsvMappingForm
          sourceFields={sourceFields}
          mappings={mappings}
          onMappingsChange={onMappingsChange}
          confidenceByTargetId={confidenceByTargetId}
          sampleRow={sampleRow}
        />
      );
    default:
      return null;
  }
}

interface CsvMappingFormProps {
  sourceFields: TSourceField[];
  mappings: TFieldMapping[];
  onMappingsChange: (mappings: TFieldMapping[]) => void;
  confidenceByTargetId?: Record<string, TMappingConfidence>;
  sampleRow?: Record<string, string>;
}

const CsvMappingForm = ({
  sourceFields,
  mappings,
  onMappingsChange,
  confidenceByTargetId,
  sampleRow,
}: CsvMappingFormProps) => {
  const { t } = useTranslation();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const fieldsById = new Map(CSV_TARGET_FIELDS.map((f) => [f.id, f]));
  const targetNameById = useMemo(() => Object.fromEntries(CSV_TARGET_FIELDS.map((f) => [f.id, f.name])), []);

  const upsertMapping = (next: TFieldMapping) => {
    const filtered = mappings.filter((m) => m.targetFieldId !== next.targetFieldId);
    onMappingsChange([...filtered, next]);
  };

  const removeMapping = (targetFieldId: string) => {
    onMappingsChange(mappings.filter((m) => m.targetFieldId !== targetFieldId));
  };

  const handleChange = (targetFieldId: string, next: TFieldMapping | null) => {
    if (next === null) removeMapping(targetFieldId);
    else upsertMapping(next);
  };

  const responseValueMapping = mappings.find((m) => m.targetFieldId === "response_value");
  const fieldTypeMapping = mappings.find((m) => m.targetFieldId === "field_type");
  const responseValuePreview = computeResponseValuePreview({
    responseValueMapping,
    fieldTypeMapping,
    sampleRow,
    sourceFields,
    t,
  });

  const renderField = (target: TTargetField) => {
    const mapping = mappings.find((m) => m.targetFieldId === target.id) ?? null;
    const autoMapState = toAutoMapState(confidenceByTargetId?.[target.id]);
    const sourceColumnName = mapping?.sourceFieldId
      ? sourceFields.find((s) => s.id === mapping.sourceFieldId)?.name
      : undefined;
    const isResponseValue = target.id === "response_value";

    return (
      <FormTargetField
        key={target.id}
        field={target}
        mapping={mapping}
        sourceFields={sourceFields}
        allMappings={mappings}
        targetNameById={targetNameById}
        onChange={(next) => handleChange(target.id, next)}
        autoMapState={autoMapState}
        autoMapSourceColumn={sourceColumnName}
        preview={isResponseValue ? responseValuePreview : undefined}
      />
    );
  };

  const renderGroup = (ids: readonly string[]) =>
    ids
      .map((id) => fieldsById.get(id))
      .filter((f): f is TTargetField => Boolean(f))
      .map(renderField);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div>
          <p className="text-sm font-semibold text-slate-800">{t("workspace.unify.csv_basic_required")}</p>
          <p className="text-xs text-slate-500">{t("workspace.unify.csv_basic_required_hint")}</p>
        </div>
        <div className="space-y-2">{renderGroup(CSV_FIELD_GROUPS.basic)}</div>
      </div>

      <div className="space-y-2">
        <div>
          <p className="text-sm font-semibold text-slate-800">{t("workspace.unify.csv_source_context")}</p>
          <p className="text-xs text-slate-500">{t("workspace.unify.csv_source_context_hint")}</p>
        </div>
        <div className="space-y-2">{renderGroup(CSV_FIELD_GROUPS.sourceContext)}</div>
      </div>

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="flex w-full items-start gap-2 rounded text-left">
          <span className="mt-0.5 text-slate-500">
            {advancedOpen ? (
              <ChevronDownIcon className="h-4 w-4" />
            ) : (
              <ChevronRightIcon className="h-4 w-4" />
            )}
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-800">
              {t("workspace.unify.csv_advanced")}
            </span>
            <span className="block text-xs text-slate-500">{t("workspace.unify.csv_advanced_hint")}</span>
          </span>
        </button>
        {advancedOpen && <div className="space-y-2">{renderGroup(CSV_FIELD_GROUPS.advanced)}</div>}
      </div>
    </div>
  );
};

interface ComputePreviewArgs {
  responseValueMapping: TFieldMapping | undefined;
  fieldTypeMapping: TFieldMapping | undefined;
  sampleRow: Record<string, string> | undefined;
  sourceFields: TSourceField[];
  t: ReturnType<typeof useTranslation>["t"];
}

const computeResponseValuePreview = ({
  responseValueMapping,
  fieldTypeMapping,
  sampleRow,
  sourceFields,
  t,
}: ComputePreviewArgs): string | undefined => {
  if (!responseValueMapping?.sourceFieldId) return undefined;
  const fieldTypeRaw = fieldTypeMapping?.staticValue ?? "";
  const parsed = ZHubFieldType.safeParse(fieldTypeRaw);
  if (!parsed.success) return undefined;
  const fieldType: THubFieldType = parsed.data;
  const target = routeResponseValueTarget(fieldType);
  const sample =
    sampleRow?.[responseValueMapping.sourceFieldId] ??
    sourceFields.find((f) => f.id === responseValueMapping.sourceFieldId)?.sampleValue ??
    "";
  const localizedTarget = t(`workspace.unify.fields.${target.replace("value_", "")}`);
  return t("workspace.unify.csv_response_preview", {
    sample,
    target: localizedTarget,
  });
};
