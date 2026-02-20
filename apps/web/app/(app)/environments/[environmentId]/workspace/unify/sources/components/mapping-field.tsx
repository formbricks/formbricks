"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { ChevronDownIcon, GripVerticalIcon, PencilIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/modules/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { TFieldMapping, TSourceField, TTargetField } from "../types";

interface DraggableSourceFieldProps {
  field: TSourceField;
  isMapped: boolean;
}

export function DraggableSourceField({ field, isMapped }: DraggableSourceFieldProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: field.id,
    data: field,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`flex cursor-grab items-center gap-2 rounded-md border p-2 text-sm transition-colors ${
        isDragging
          ? "border-brand-dark bg-slate-100 opacity-50"
          : isMapped
            ? "border-green-300 bg-green-50 text-green-800"
            : "border-slate-200 bg-white hover:border-slate-300"
      }`}>
      <GripVerticalIcon className="h-4 w-4 text-slate-400" />
      <div className="flex-1 truncate">
        <span className="font-medium">{field.name}</span>
        <span className="ml-2 text-xs text-slate-500">({field.type})</span>
      </div>
      {field.sampleValue && (
        <span className="max-w-24 truncate text-xs text-slate-400">{field.sampleValue}</span>
      )}
    </div>
  );
}

interface DroppableTargetFieldProps {
  field: TTargetField;
  mappedSourceField: TSourceField | null;
  mapping: TFieldMapping | null;
  onRemoveMapping: () => void;
  onStaticValueChange: (value: string) => void;
  isOver?: boolean;
}

export function DroppableTargetField({
  field,
  mappedSourceField,
  mapping,
  onRemoveMapping,
  onStaticValueChange,
  isOver,
}: DroppableTargetFieldProps) {
  const { t } = useTranslation();
  const { setNodeRef, isOver: isOverCurrent } = useDroppable({
    id: field.id,
    data: field,
  });

  const [isEditingStatic, setIsEditingStatic] = useState(false);
  const [customValue, setCustomValue] = useState("");

  const isActive = isOver || isOverCurrent;
  const hasMapping = mappedSourceField || mapping?.staticValue;

  // Handle enum field type - show dropdown
  if (field.type === "enum" && field.enumValues) {
    return (
      <div
        ref={setNodeRef}
        className={`flex items-center gap-2 rounded-md border p-2 text-sm transition-colors ${
          mapping?.staticValue ? "border-green-300 bg-green-50" : "border-dashed border-slate-300 bg-slate-50"
        }`}>
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900">{field.name}</span>
            {field.required && <span className="text-xs text-red-500">*</span>}
            <span className="text-xs text-slate-400">enum</span>
          </div>
          <Select value={mapping?.staticValue || ""} onValueChange={onStaticValueChange}>
            <SelectTrigger className="h-8 w-full bg-white">
              <SelectValue placeholder={t("environments.unify.select_a_value")} />
            </SelectTrigger>
            <SelectContent>
              {field.enumValues.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  // Handle string fields - allow drag & drop OR static value
  if (field.type === "string") {
    return (
      <div
        ref={setNodeRef}
        className={`flex items-center gap-2 rounded-md border p-2 text-sm transition-colors ${
          isActive
            ? "border-brand-dark bg-slate-100"
            : hasMapping
              ? "border-green-300 bg-green-50"
              : "border-dashed border-slate-300 bg-slate-50"
        }`}>
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900">{field.name}</span>
            {field.required && <span className="text-xs text-red-500">*</span>}
          </div>

          {/* Show mapped source field */}
          {mappedSourceField && !mapping?.staticValue && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-green-700">← {mappedSourceField.name}</span>
              <button
                type="button"
                onClick={onRemoveMapping}
                className="ml-1 rounded p-0.5 hover:bg-green-100">
                <XIcon className="h-3 w-3 text-green-600" />
              </button>
            </div>
          )}

          {/* Show static value */}
          {mapping?.staticValue && !mappedSourceField && (
            <div className="flex items-center gap-1">
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">
                = &ldquo;{mapping.staticValue}&rdquo;
              </span>
              <button
                type="button"
                onClick={onRemoveMapping}
                className="ml-1 rounded p-0.5 hover:bg-blue-100">
                <XIcon className="h-3 w-3 text-blue-600" />
              </button>
            </div>
          )}

          {/* Show input for entering static value when editing */}
          {isEditingStatic && !hasMapping && (
            <div className="flex items-center gap-1">
              <Input
                type="text"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                placeholder={
                  field.exampleStaticValues ? `e.g., ${field.exampleStaticValues[0]}` : "Enter value..."
                }
                className="h-7 text-xs"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customValue.trim()) {
                    onStaticValueChange(customValue.trim());
                    setCustomValue("");
                    setIsEditingStatic(false);
                  }
                  if (e.key === "Escape") {
                    setCustomValue("");
                    setIsEditingStatic(false);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  if (customValue.trim()) {
                    onStaticValueChange(customValue.trim());
                    setCustomValue("");
                  }
                  setIsEditingStatic(false);
                }}
                className="rounded p-1 text-slate-500 hover:bg-slate-200">
                <ChevronDownIcon className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Show example values as quick select OR drop zone */}
          {!hasMapping && !isEditingStatic && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-xs text-slate-400">{t("environments.unify.drop_field_or")}</span>
              <button
                type="button"
                onClick={() => setIsEditingStatic(true)}
                className="flex items-center gap-1 rounded px-1 py-0.5 text-xs text-slate-500 hover:bg-slate-200">
                <PencilIcon className="h-3 w-3" />
                {t("environments.unify.set_value")}
              </button>
              {field.exampleStaticValues && field.exampleStaticValues.length > 0 && (
                <>
                  <span className="text-xs text-slate-300">|</span>
                  {field.exampleStaticValues.slice(0, 3).map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => onStaticValueChange(val)}
                      className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 hover:bg-slate-200">
                      {val}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Helper to get display label for static values
  const getStaticValueLabel = (value: string) => {
    if (value === "$now") return t("environments.unify.feedback_date");
    return value;
  };

  // Default behavior for other field types (timestamp, float64, boolean, jsonb, etc.)
  const hasDefaultMapping = mappedSourceField || mapping?.staticValue;

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-2 rounded-md border p-2 text-sm transition-colors ${
        isActive
          ? "border-brand-dark bg-slate-100"
          : hasDefaultMapping
            ? "border-green-300 bg-green-50"
            : "border-dashed border-slate-300 bg-slate-50"
      }`}>
      <div className="flex flex-1 flex-col">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900">{field.name}</span>
          {field.required && <span className="text-xs text-red-500">*</span>}
          <span className="text-xs text-slate-400">({field.type})</span>
        </div>

        {/* Show mapped source field */}
        {mappedSourceField && !mapping?.staticValue && (
          <div className="mt-1 flex items-center gap-1">
            <span className="text-xs text-green-700">← {mappedSourceField.name}</span>
            <button type="button" onClick={onRemoveMapping} className="ml-1 rounded p-0.5 hover:bg-green-100">
              <XIcon className="h-3 w-3 text-green-600" />
            </button>
          </div>
        )}

        {/* Show static value */}
        {mapping?.staticValue && !mappedSourceField && (
          <div className="mt-1 flex items-center gap-1">
            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">
              = {getStaticValueLabel(mapping.staticValue)}
            </span>
            <button type="button" onClick={onRemoveMapping} className="ml-1 rounded p-0.5 hover:bg-blue-100">
              <XIcon className="h-3 w-3 text-blue-600" />
            </button>
          </div>
        )}

        {/* Show drop zone with preset options */}
        {!hasDefaultMapping && (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <span className="text-xs text-slate-400">{t("environments.unify.drop_a_field_here")}</span>
            {field.exampleStaticValues && field.exampleStaticValues.length > 0 && (
              <>
                <span className="text-xs text-slate-300">|</span>
                {field.exampleStaticValues.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => onStaticValueChange(val)}
                    className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 hover:bg-slate-200">
                    {getStaticValueLabel(val)}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
