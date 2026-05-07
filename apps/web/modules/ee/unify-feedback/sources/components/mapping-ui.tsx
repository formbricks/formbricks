"use client";

import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from "@dnd-kit/core";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TConnectorType, THubFieldType, ZHubFieldType } from "@formbricks/types/connector";
import {
  CSV_FIELD_GROUPS,
  CSV_TARGET_FIELDS,
  FEEDBACK_RECORD_FIELDS,
  TFieldMapping,
  TSourceField,
  TTargetField,
} from "../types";
import { TMappingConfidence, routeResponseValueTarget } from "../utils";
import { DraggableSourceField, DroppableTargetField, FormTargetField, TAutoMapState } from "./mapping-field";

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
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const sourceFieldId = active.id as string;
    const targetFieldId = over.id as string;

    const newMappings = mappings.filter(
      (m) => m.sourceFieldId !== sourceFieldId && m.targetFieldId !== targetFieldId
    );
    onMappingsChange([...newMappings, { sourceFieldId, targetFieldId }]);
  };

  const handleRemoveMapping = (targetFieldId: string) => {
    onMappingsChange(mappings.filter((m) => m.targetFieldId !== targetFieldId));
  };

  const handleStaticValueChange = (targetFieldId: string, staticValue: string) => {
    const newMappings = mappings.filter((m) => m.targetFieldId !== targetFieldId);
    onMappingsChange([...newMappings, { targetFieldId, staticValue }]);
  };

  const getSourceFieldById = (id: string) => sourceFields.find((f) => f.id === id);

  const getMappingForTarget = (targetFieldId: string) => {
    return mappings.find((m) => m.targetFieldId === targetFieldId) ?? null;
  };

  const getMappedSourceField = (targetFieldId: string) => {
    const mapping = getMappingForTarget(targetFieldId);
    return mapping?.sourceFieldId ? getSourceFieldById(mapping.sourceFieldId) : null;
  };

  const isSourceFieldMapped = (sourceFieldId: string) =>
    mappings.some((m) => m.sourceFieldId === sourceFieldId);

  const activeField = activeId ? getSourceFieldById(activeId) : null;

  if (connectorType === "csv") {
    return (
      <CsvMappingForm
        sourceFields={sourceFields}
        mappings={mappings}
        onMappingsChange={onMappingsChange}
        confidenceByTargetId={confidenceByTargetId}
        sampleRow={sampleRow}
      />
    );
  }

  // Survey (and other future) connectors keep the DnD layout.
  const requiredFields = FEEDBACK_RECORD_FIELDS.filter((f) => f.required);
  const optionalFields = FEEDBACK_RECORD_FIELDS.filter((f) => !f.required);

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-slate-700">{t("workspace.unify.source_fields")}</h4>

          {sourceFields.length === 0 ? (
            <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
              <p className="text-sm text-slate-500">{t("workspace.unify.no_source_fields_loaded")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sourceFields.map((field) => (
                <DraggableSourceField key={field.id} field={field} isMapped={isSourceFieldMapped(field.id)} />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-medium text-slate-700">
            {t("workspace.unify.feedback_record_fields")}
          </h4>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("workspace.unify.required")}
            </p>
            {requiredFields.map((targetField) => (
              <DroppableTargetField
                key={targetField.id}
                field={targetField}
                mappedSourceField={getMappedSourceField(targetField.id) ?? null}
                mapping={getMappingForTarget(targetField.id)}
                onRemoveMapping={() => handleRemoveMapping(targetField.id)}
                onStaticValueChange={(value) => handleStaticValueChange(targetField.id, value)}
              />
            ))}
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("workspace.unify.optional")}
            </p>
            {optionalFields.map((targetField) => (
              <DroppableTargetField
                key={targetField.id}
                field={targetField}
                mappedSourceField={getMappedSourceField(targetField.id) ?? null}
                mapping={getMappingForTarget(targetField.id)}
                onRemoveMapping={() => handleRemoveMapping(targetField.id)}
                onStaticValueChange={(value) => handleStaticValueChange(targetField.id, value)}
              />
            ))}
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeField ? (
          <div className="rounded-md border border-brand-dark bg-white p-2 text-sm shadow-lg">
            <span className="font-medium">{activeField.name}</span>
            <span className="ml-2 text-xs text-slate-500">({activeField.type})</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
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
  const targetLabel = target.replace("value_", "");
  return t("workspace.unify.csv_response_preview", {
    sample,
    target: targetLabel.charAt(0).toUpperCase() + targetLabel.slice(1),
  });
};
