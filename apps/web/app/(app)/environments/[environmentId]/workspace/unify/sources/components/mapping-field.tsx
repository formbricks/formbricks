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
import { cn } from "@/modules/ui/lib/utils";
import { TFieldMapping, TSourceField, TTargetField } from "../types";

interface DraggableSourceFieldProps {
  field: TSourceField;
  isMapped: boolean;
}

export const DraggableSourceField = ({ field, isMapped }: DraggableSourceFieldProps) => {
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
};

const getMappingStateClass = (isActive: boolean, hasMapping: unknown): string => {
  if (isActive) return "border-brand-dark bg-slate-100";
  if (hasMapping) return "border-green-300 bg-green-50";
  return "border-dashed border-slate-300 bg-slate-50";
};

interface RemoveMappingButtonProps {
  onClick: () => void;
  variant: "green" | "blue";
}

const RemoveMappingButton = ({ onClick, variant }: RemoveMappingButtonProps) => {
  const colorClass = variant === "green" ? "hover:bg-green-100" : "hover:bg-blue-100";
  const iconClass = variant === "green" ? "text-green-600" : "text-blue-600";
  return (
    <button type="button" onClick={onClick} className={`ml-1 rounded p-0.5 ${colorClass}`}>
      <XIcon className={`h-3 w-3 ${iconClass}`} />
    </button>
  );
};

interface EnumTargetFieldContentProps {
  field: TTargetField;
  mappedSourceField: TSourceField | null;
  mapping: TFieldMapping | null;
  onRemoveMapping: () => void;
  onStaticValueChange: (value: string) => void;
  t: (key: string) => string;
}

const EnumTargetFieldContent = ({
  field,
  mappedSourceField,
  mapping,
  onRemoveMapping,
  onStaticValueChange,
  t,
}: EnumTargetFieldContentProps) => {
  return (
    <div className="flex flex-1 flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="font-medium text-slate-900">{field.name}</span>
        {field.required && <span className="text-xs text-red-500">*</span>}
        <span className="text-xs text-slate-400">{t("environments.unify.enum")}</span>
      </div>

      {mappedSourceField && !mapping?.staticValue ? (
        <div className="flex items-center gap-1">
          <span className="text-xs text-green-700">&larr; {mappedSourceField.name}</span>
          <RemoveMappingButton onClick={onRemoveMapping} variant="green" />
        </div>
      ) : (
        <Select value={mapping?.staticValue || ""} onValueChange={onStaticValueChange}>
          <SelectTrigger className="h-8 w-full bg-white">
            <SelectValue placeholder={t("environments.unify.select_a_value")} />
          </SelectTrigger>
          <SelectContent>
            {field.enumValues?.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};

interface StringTargetFieldContentProps {
  field: TTargetField;
  mappedSourceField: TSourceField | null;
  mapping: TFieldMapping | null;
  hasMapping: unknown;
  onRemoveMapping: () => void;
  onStaticValueChange: (value: string) => void;
  t: (key: string) => string;
}

const StringTargetFieldContent = ({
  field,
  mappedSourceField,
  mapping,
  hasMapping,
  onRemoveMapping,
  onStaticValueChange,
  t,
}: StringTargetFieldContentProps) => {
  const [isEditingStatic, setIsEditingStatic] = useState(false);
  const [customValue, setCustomValue] = useState("");

  return (
    <div className="flex flex-1 flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="font-medium text-slate-900">{field.name}</span>
        {field.required && <span className="text-xs text-red-500">*</span>}
      </div>

      {mappedSourceField && !mapping?.staticValue && (
        <div className="flex items-center gap-1">
          <span className="text-xs text-green-700">← {mappedSourceField.name}</span>
          <RemoveMappingButton onClick={onRemoveMapping} variant="green" />
        </div>
      )}

      {mapping?.staticValue && !mappedSourceField && (
        <div className="flex items-center gap-1">
          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">
            = &ldquo;{mapping.staticValue}&rdquo;
          </span>
          <RemoveMappingButton onClick={onRemoveMapping} variant="blue" />
        </div>
      )}

      {isEditingStatic && !hasMapping && (
        <div className="flex items-center gap-1">
          <Input
            type="text"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            placeholder={
              field.exampleStaticValues
                ? `e.g., ${field.exampleStaticValues[0]}`
                : t("environments.unify.enter_value")
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
  );
};

interface DroppableTargetFieldProps {
  field: TTargetField;
  mappedSourceField: TSourceField | null;
  mapping: TFieldMapping | null;
  onRemoveMapping: () => void;
  onStaticValueChange: (value: string) => void;
  isOver?: boolean;
}

export const DroppableTargetField = ({
  field,
  mappedSourceField,
  mapping,
  onRemoveMapping,
  onStaticValueChange,
  isOver,
}: DroppableTargetFieldProps) => {
  const { t } = useTranslation();
  const { setNodeRef, isOver: isOverCurrent } = useDroppable({
    id: field.id,
    data: field,
  });

  const isActive = isOver || isOverCurrent;
  const hasMapping = mappedSourceField || mapping?.staticValue;
  const containerClass = cn(
    "flex items-center gap-2 rounded-md border p-2 text-sm transition-colors",
    getMappingStateClass(!!isActive, hasMapping)
  );

  if (field.type === "enum" && field.enumValues) {
    return (
      <div ref={setNodeRef} className={containerClass}>
        <EnumTargetFieldContent
          field={field}
          mappedSourceField={mappedSourceField}
          mapping={mapping}
          onRemoveMapping={onRemoveMapping}
          onStaticValueChange={onStaticValueChange}
          t={t}
        />
      </div>
    );
  }

  if (field.type === "string") {
    return (
      <div ref={setNodeRef} className={containerClass}>
        <StringTargetFieldContent
          field={field}
          mappedSourceField={mappedSourceField}
          mapping={mapping}
          hasMapping={hasMapping}
          onRemoveMapping={onRemoveMapping}
          onStaticValueChange={onStaticValueChange}
          t={t}
        />
      </div>
    );
  }

  // Helper to get display label for static values
  const getStaticValueLabel = (value: string) => {
    if (value === "$now") return t("environments.unify.feedback_date");
    return value;
  };

  return (
    <div ref={setNodeRef} className={containerClass}>
      <div className="flex flex-1 flex-col">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900">{field.name}</span>
          {field.required && <span className="text-xs text-red-500">*</span>}
          <span className="text-xs text-slate-400">({field.type})</span>
        </div>

        {mappedSourceField && !mapping?.staticValue && (
          <div className="mt-1 flex items-center gap-1">
            <span className="text-xs text-green-700">← {mappedSourceField.name}</span>
            <RemoveMappingButton onClick={onRemoveMapping} variant="green" />
          </div>
        )}

        {mapping?.staticValue && !mappedSourceField && (
          <div className="mt-1 flex items-center gap-1">
            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">
              = {getStaticValueLabel(mapping.staticValue)}
            </span>
            <RemoveMappingButton onClick={onRemoveMapping} variant="blue" />
          </div>
        )}

        {!hasMapping && (
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
};
