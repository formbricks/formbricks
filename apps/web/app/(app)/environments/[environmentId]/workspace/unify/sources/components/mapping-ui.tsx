"use client";

import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from "@dnd-kit/core";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FEEDBACK_RECORD_FIELDS, TFieldMapping, TSourceField, TSourceType } from "../types";
import { DraggableSourceField, DroppableTargetField } from "./mapping-field";

interface MappingUIProps {
  sourceFields: TSourceField[];
  mappings: TFieldMapping[];
  onMappingsChange: (mappings: TFieldMapping[]) => void;
  sourceType: TSourceType;
}

export function MappingUI({ sourceFields, mappings, onMappingsChange, sourceType }: MappingUIProps) {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<string | null>(null);

  const requiredFields = FEEDBACK_RECORD_FIELDS.filter((f) => f.required);
  const optionalFields = FEEDBACK_RECORD_FIELDS.filter((f) => !f.required);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const sourceFieldId = active.id as string;
    const targetFieldId = over.id as string;

    const existingMapping = mappings.find((m) => m.targetFieldId === targetFieldId);
    if (existingMapping) {
      const newMappings = mappings.filter((m) => m.targetFieldId !== targetFieldId);
      onMappingsChange([...newMappings, { sourceFieldId, targetFieldId }]);
    } else {
      const newMappings = mappings.filter((m) => m.sourceFieldId !== sourceFieldId);
      onMappingsChange([...newMappings, { sourceFieldId, targetFieldId }]);
    }
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

  const getSourceTypeLabel = () => {
    switch (sourceType) {
      case "csv":
        return t("environments.unify.csv_columns");
      default:
        return t("environments.unify.source_fields");
    }
  };

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-2 gap-6">
        {/* Source Fields Panel */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-slate-700">{getSourceTypeLabel()}</h4>

          {sourceFields.length === 0 ? (
            <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
              <p className="text-sm text-slate-500">
                {sourceType === "csv"
                  ? t("environments.unify.click_load_sample_csv")
                  : t("environments.unify.no_source_fields_loaded")}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sourceFields.map((field) => (
                <DraggableSourceField key={field.id} field={field} isMapped={isSourceFieldMapped(field.id)} />
              ))}
            </div>
          )}
        </div>

        {/* Target Fields Panel */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-slate-700">
            {t("environments.unify.hub_feedback_record_fields")}
          </h4>

          {/* Required Fields */}
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("environments.unify.required")}
            </p>
            {requiredFields.map((field) => (
              <DroppableTargetField
                key={field.id}
                field={field}
                mappedSourceField={getMappedSourceField(field.id) ?? null}
                mapping={getMappingForTarget(field.id)}
                onRemoveMapping={() => handleRemoveMapping(field.id)}
                onStaticValueChange={(value) => handleStaticValueChange(field.id, value)}
              />
            ))}
          </div>

          {/* Optional Fields */}
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("environments.unify.optional")}
            </p>
            {optionalFields.map((field) => (
              <DroppableTargetField
                key={field.id}
                field={field}
                mappedSourceField={getMappedSourceField(field.id) ?? null}
                mapping={getMappingForTarget(field.id)}
                onRemoveMapping={() => handleRemoveMapping(field.id)}
                onStaticValueChange={(value) => handleStaticValueChange(field.id, value)}
              />
            ))}
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeField ? (
          <div className="border-brand-dark rounded-md border bg-white p-2 text-sm shadow-lg">
            <span className="font-medium">{activeField.name}</span>
            <span className="ml-2 text-xs text-slate-500">({activeField.type})</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
