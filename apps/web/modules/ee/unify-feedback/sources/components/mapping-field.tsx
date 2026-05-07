"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import {
  AlertTriangleIcon,
  ChevronDownIcon,
  ClockIcon,
  GripVerticalIcon,
  MinusCircleIcon,
  PencilIcon,
  SparklesIcon,
  TextCursorInputIcon,
  XIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { cn } from "@/modules/ui/lib/utils";
import { TFieldMapping, TSourceField, TTargetField } from "../types";

interface DraggableSourceFieldProps {
  field: TSourceField;
  isMapped: boolean;
}

const getSourceFieldStateClass = (isDragging: boolean, isMapped: boolean): string => {
  if (isDragging) return "border-brand-dark bg-slate-100 opacity-50";
  if (isMapped) return "border-green-300 bg-green-50 text-green-800";
  return "border-slate-200 bg-white hover:border-slate-300";
};

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
      className={`flex cursor-grab items-center gap-2 rounded-md border p-2 text-sm transition-colors ${getSourceFieldStateClass(isDragging, isMapped)}`}>
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
        <span className="text-xs text-slate-400">{t("workspace.unify.enum")}</span>
      </div>

      {mappedSourceField && !mapping?.staticValue ? (
        <div className="flex items-center gap-1">
          <span className="text-xs text-green-700">&larr; {mappedSourceField.name}</span>
          <RemoveMappingButton onClick={onRemoveMapping} variant="green" />
        </div>
      ) : (
        <Select value={mapping?.staticValue || ""} onValueChange={onStaticValueChange}>
          <SelectTrigger className="h-8 w-full bg-white">
            <SelectValue placeholder={t("workspace.unify.select_a_value")} />
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
                : t("workspace.unify.enter_value")
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
          <span className="text-xs text-slate-400">{t("workspace.unify.drop_field_or")}</span>
          <button
            type="button"
            onClick={() => setIsEditingStatic(true)}
            className="flex items-center gap-1 rounded px-1 py-0.5 text-xs text-slate-500 hover:bg-slate-200">
            <PencilIcon className="h-3 w-3" />
            {t("workspace.unify.set_value")}
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

export type TAutoMapState = "high" | "medium" | "low";

interface AutoMappedBadgeProps {
  state: TAutoMapState;
  sourceColumn?: string;
}

const AUTO_MAP_BADGE_STYLES: Record<TAutoMapState, string> = {
  high: "bg-indigo-50 text-indigo-700",
  medium: "bg-amber-50 text-amber-800",
  low: "bg-orange-100 text-orange-800",
};

export const AutoMappedBadge = ({ state, sourceColumn }: AutoMappedBadgeProps) => {
  const { t } = useTranslation();
  const isHigh = state === "high";
  const Icon = isHigh ? SparklesIcon : AlertTriangleIcon;
  const className = cn(
    "ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
    AUTO_MAP_BADGE_STYLES[state]
  );
  const label = isHigh ? t("workspace.unify.csv_auto_mapped") : t("workspace.unify.csv_auto_mapped_verify");

  return (
    <TooltipRenderer
      tooltipContent={t("workspace.unify.csv_auto_mapped_tooltip", { column: sourceColumn ?? "—" })}>
      <span className={className}>
        <Icon className="h-3 w-3" />
        {label}
      </span>
    </TooltipRenderer>
  );
};

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
    if (value === "$now") return t("workspace.unify.feedback_date");
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
            <span className="text-xs text-slate-400">{t("workspace.unify.drop_a_field_here")}</span>
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

const SENTINEL = {
  COLUMN_PREFIX: "__col__:",
  ENUM_PREFIX: "__enum__:",
  STATIC_NOW: "__static_now__",
  EDIT_FIXED: "__edit_fixed__",
  CLEAR: "__clear__",
} as const;

// Section header inside a Select dropdown (e.g. "CSV Columns") — small, uppercase, muted; reads
// as a label rather than a clickable option. Sized to match secondary text (text-xs).
const GROUP_LABEL_CLASS = "px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500";

interface FormTargetFieldProps {
  field: TTargetField;
  mapping: TFieldMapping | null;
  sourceFields: TSourceField[];
  /** All current mappings — used to flag columns already mapped to a different target. */
  allMappings: TFieldMapping[];
  /** Lookup of target-field id → display name, for the "Mapped to: …" indicator. */
  targetNameById: Record<string, string>;
  onChange: (next: TFieldMapping | null) => void;
  autoMapState?: TAutoMapState;
  autoMapSourceColumn?: string;
  preview?: string;
}

export const FormTargetField = ({
  field,
  mapping,
  sourceFields,
  allMappings,
  targetNameById,
  onChange,
  autoMapState,
  autoMapSourceColumn,
  preview,
}: FormTargetFieldProps) => {
  const { t } = useTranslation();
  const [isEditingFixed, setIsEditingFixed] = useState(false);
  const [draftFixedValue, setDraftFixedValue] = useState("");

  const hasMapping = Boolean(mapping?.sourceFieldId || mapping?.staticValue);
  const isEnum = field.type === "enum" && Boolean(field.enumValues?.length);
  const isTimestamp = field.type === "timestamp";

  // For each column, the name of another target it's mapped to (excluding this row's target).
  // Used to render a "Mapped to: …" badge on column options so the user can tell at a glance which
  // columns are already in use elsewhere.
  const otherUsageByColumn = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of allMappings) {
      if (!m.sourceFieldId) continue;
      if (m.targetFieldId === field.id) continue;
      map[m.sourceFieldId] = targetNameById[m.targetFieldId] ?? m.targetFieldId;
    }
    return map;
  }, [allMappings, field.id, targetNameById]);

  const selectValue = useMemo(() => {
    if (mapping?.sourceFieldId) return `${SENTINEL.COLUMN_PREFIX}${mapping.sourceFieldId}`;
    if (mapping?.staticValue === "$now") return SENTINEL.STATIC_NOW;
    if (isEnum && mapping?.staticValue) return `${SENTINEL.ENUM_PREFIX}${mapping.staticValue}`;
    // Fixed value (non-$now, non-enum) maps to the EDIT_FIXED sentinel so the trigger renders the
    // EDIT_FIXED item's "Edit fixed value: …" label.
    if (mapping?.staticValue !== undefined && mapping?.staticValue !== "") {
      return SENTINEL.EDIT_FIXED;
    }
    return "";
  }, [mapping, isEnum]);

  const openFixedValueEditor = () => {
    setDraftFixedValue(mapping?.staticValue && mapping.staticValue !== "$now" ? mapping.staticValue : "");
    setIsEditingFixed(true);
  };

  const handleSelectChange = (value: string) => {
    if (value.startsWith(SENTINEL.COLUMN_PREFIX)) {
      onChange({
        targetFieldId: field.id,
        sourceFieldId: value.slice(SENTINEL.COLUMN_PREFIX.length),
      });
      setIsEditingFixed(false);
      return;
    }
    if (value === SENTINEL.STATIC_NOW) {
      onChange({ targetFieldId: field.id, staticValue: "$now" });
      setIsEditingFixed(false);
      return;
    }
    if (value.startsWith(SENTINEL.ENUM_PREFIX)) {
      onChange({
        targetFieldId: field.id,
        staticValue: value.slice(SENTINEL.ENUM_PREFIX.length),
      });
      setIsEditingFixed(false);
      return;
    }
    if (value === SENTINEL.EDIT_FIXED) {
      openFixedValueEditor();
      return;
    }
    if (value === SENTINEL.CLEAR) {
      onChange(null);
      setIsEditingFixed(false);
    }
  };

  const handleSaveFixed = () => {
    const trimmed = draftFixedValue.trim();
    if (trimmed) {
      onChange({ targetFieldId: field.id, staticValue: trimmed });
    } else if (!field.required) {
      onChange(null);
    }
    setIsEditingFixed(false);
  };

  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="flex items-baseline gap-2">
        <span className="font-medium text-slate-900">{field.name}</span>
        {field.required && <span className="text-xs text-red-500">*</span>}
        {isEnum && <span className="text-xs text-slate-400">{t("workspace.unify.enum")}</span>}
        {hasMapping && autoMapState && (
          <AutoMappedBadge state={autoMapState} sourceColumn={autoMapSourceColumn} />
        )}
      </div>
      <p className="mt-0.5 text-xs text-slate-500">{field.description}</p>

      <div className="mt-2">
        {isEditingFixed ? (
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={draftFixedValue}
              onChange={(e) => setDraftFixedValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSaveFixed();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setIsEditingFixed(false);
                }
              }}
              placeholder={t("workspace.unify.set_value")}
              className="h-9"
            />
            <Button size="sm" onClick={handleSaveFixed}>
              {t("common.done")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsEditingFixed(false)}>
              {t("common.cancel")}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Select value={selectValue || undefined} onValueChange={handleSelectChange}>
                <SelectTrigger className="h-9 w-full bg-white">
                  <SelectValue
                    placeholder={
                      isEnum
                        ? t("workspace.unify.select_a_value")
                        : t("workspace.unify.csv_pick_column_placeholder")
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {isEnum && field.enumValues ? (
                    field.enumValues.map((enumValue) => (
                      <SelectItem key={enumValue} value={`${SENTINEL.ENUM_PREFIX}${enumValue}`}>
                        {enumValue}
                      </SelectItem>
                    ))
                  ) : (
                    <>
                      {sourceFields.length > 0 && (
                        <SelectGroup>
                          <SelectLabel className={GROUP_LABEL_CLASS}>
                            {t("workspace.unify.csv_columns")}
                          </SelectLabel>
                          {sourceFields.map((column) => {
                            const otherUsage = otherUsageByColumn[column.id];
                            return (
                              <SelectItem key={column.id} value={`${SENTINEL.COLUMN_PREFIX}${column.id}`}>
                                <span className="flex w-full items-center gap-2">
                                  <span className="text-slate-900">{column.name}</span>
                                  {otherUsage && (
                                    <span className="ml-auto rounded bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-500">
                                      {t("workspace.unify.csv_column_used_by", { target: otherUsage })}
                                    </span>
                                  )}
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectGroup>
                      )}
                      {isTimestamp && (
                        <>
                          <SelectSeparator />
                          <SelectItem value={SENTINEL.STATIC_NOW}>
                            <span className="inline-flex items-center gap-2 text-slate-900">
                              <ClockIcon className="h-3.5 w-3.5" />
                              {t("workspace.unify.csv_now_label")}
                            </span>
                          </SelectItem>
                        </>
                      )}
                      <SelectSeparator />
                      <SelectItem value={SENTINEL.EDIT_FIXED}>
                        <span className="inline-flex items-center gap-2 text-slate-900">
                          <TextCursorInputIcon className="h-3.5 w-3.5" />
                          {mapping?.staticValue && mapping.staticValue !== "$now"
                            ? t("workspace.unify.csv_fixed_value_label", {
                                value: truncate(mapping.staticValue, 40),
                              })
                            : t("workspace.unify.csv_fixed_value_action")}
                        </span>
                      </SelectItem>
                      {!field.required && hasMapping && (
                        <>
                          <SelectSeparator />
                          <SelectItem value={SENTINEL.CLEAR}>
                            <span className="inline-flex items-center gap-2 text-slate-900">
                              <MinusCircleIcon className="h-3.5 w-3.5" />
                              {t("workspace.unify.dont_include")}
                            </span>
                          </SelectItem>
                        </>
                      )}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            {!isEnum && mapping?.staticValue && mapping.staticValue !== "$now" && (
              <Button
                size="sm"
                variant="secondary"
                onClick={openFixedValueEditor}
                aria-label={t("workspace.unify.csv_fixed_value_action")}
                className="shrink-0">
                <PencilIcon className="h-3.5 w-3.5" />
                {t("common.edit")}
              </Button>
            )}
          </div>
        )}
      </div>

      {preview && <p className="mt-2 text-xs text-slate-500">{preview}</p>}
    </div>
  );
};

const truncate = (value: string, max: number): string =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;
