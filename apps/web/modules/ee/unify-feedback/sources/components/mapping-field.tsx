"use client";

import { ClockIcon, EraserIcon, PencilIcon, SparklesIcon, TextCursorInputIcon } from "lucide-react";
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

export type TAutoMapState = "high" | "medium" | "low";

interface AutoMappedBadgeProps {
  sourceColumn?: string;
}

export const AutoMappedBadge = ({ sourceColumn }: AutoMappedBadgeProps) => {
  const { t } = useTranslation();
  const className = cn(
    "ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
    "bg-indigo-50 text-indigo-700"
  );
  const label = t("workspace.unify.csv_auto_mapped");

  if (!sourceColumn) {
    return (
      <span className={className}>
        <SparklesIcon className="size-3" />
        {label}
      </span>
    );
  }

  return (
    <TooltipRenderer tooltipContent={t("workspace.unify.csv_auto_mapped_tooltip", { column: sourceColumn })}>
      <span className={className}>
        <SparklesIcon className="size-3" />
        {label}
      </span>
    </TooltipRenderer>
  );
};

const SENTINEL = {
  COLUMN_PREFIX: "__col__:",
  ENUM_PREFIX: "__enum__:",
  STATIC_NOW: "__static_now__",
  EDIT_FIXED: "__edit_fixed__",
  CLEAR: "__clear__",
} as const;

const GROUP_LABEL_CLASS = "px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500";
const ACTION_ITEM_CLASS = "text-slate-700 focus:bg-slate-50";
const ACTION_ICON_CLASS = "h-3.5 w-3.5 text-slate-500";

interface FormTargetFieldProps {
  field: TTargetField;
  mapping: TFieldMapping | null;
  sourceFields: TSourceField[];
  allMappings: TFieldMapping[];
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
    if (mapping?.staticValue !== undefined && mapping?.staticValue !== "") {
      return SENTINEL.EDIT_FIXED;
    }
    return "";
  }, [mapping, isEnum]);

  const selectDisplayValue = useMemo(() => {
    if (mapping?.sourceFieldId) {
      return sourceFields.find((sourceField) => sourceField.id === mapping.sourceFieldId)?.name;
    }
    if (mapping?.staticValue === "$now") return t("workspace.unify.csv_now_label");
    if (isEnum && mapping?.staticValue) return mapping.staticValue;
    if (mapping?.staticValue !== undefined && mapping?.staticValue !== "") {
      return t("workspace.unify.csv_fixed_value_label", {
        value: truncate(mapping.staticValue, 40),
      });
    }
    return undefined;
  }, [isEnum, mapping, sourceFields, t]);

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
        {hasMapping && autoMapState && <AutoMappedBadge sourceColumn={autoMapSourceColumn} />}
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
              <Select value={selectValue} onValueChange={handleSelectChange}>
                <SelectTrigger className="h-9 w-full bg-white">
                  <SelectValue
                    placeholder={
                      isEnum
                        ? t("workspace.unify.select_a_value")
                        : t("workspace.unify.csv_pick_column_placeholder")
                    }>
                    {selectDisplayValue}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {isEnum &&
                    field.enumValues?.map((enumValue) => (
                      <SelectItem key={enumValue} value={`${SENTINEL.ENUM_PREFIX}${enumValue}`}>
                        {enumValue}
                      </SelectItem>
                    ))}
                  {!isEnum && sourceFields.length > 0 && (
                    <SelectGroup>
                      <SelectLabel className={GROUP_LABEL_CLASS}>
                        {t("workspace.unify.csv_columns")}
                      </SelectLabel>
                      {sourceFields.map((column) => {
                        const otherUsage = otherUsageByColumn[column.id];
                        const sampleValue = column.sampleValue?.trim();
                        const sampleLabel = sampleValue
                          ? t("workspace.unify.csv_first_value", { value: truncate(sampleValue, 48) })
                          : undefined;
                        return (
                          <SelectItem
                            key={column.id}
                            value={`${SENTINEL.COLUMN_PREFIX}${column.id}`}
                            textValue={column.name}
                            className="py-2">
                            <span className="flex min-w-0 flex-col">
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="truncate text-slate-900">{column.name}</span>
                                {otherUsage && (
                                  <span className="shrink-0 rounded-sm bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-500">
                                    {t("workspace.unify.csv_column_used_by", { target: otherUsage })}
                                  </span>
                                )}
                              </span>
                              {sampleLabel && (
                                <span className="mt-0.5 truncate text-xs font-normal text-slate-400">
                                  {sampleLabel}
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
                      <SelectItem value={SENTINEL.STATIC_NOW} className={ACTION_ITEM_CLASS}>
                        <span className="inline-flex items-center gap-2 font-normal">
                          <ClockIcon className={ACTION_ICON_CLASS} />
                          {t("workspace.unify.csv_now_label")}
                        </span>
                      </SelectItem>
                    </>
                  )}
                  {!isEnum && (
                    <>
                      <SelectSeparator />
                      <SelectItem value={SENTINEL.EDIT_FIXED} className={ACTION_ITEM_CLASS}>
                        <span className="inline-flex items-center gap-2 font-normal">
                          <TextCursorInputIcon className="size-3.5 text-indigo-500" />
                          {mapping?.staticValue && mapping.staticValue !== "$now"
                            ? t("workspace.unify.csv_fixed_value_label", {
                                value: truncate(mapping.staticValue, 40),
                              })
                            : t("workspace.unify.csv_fixed_value_action")}
                        </span>
                      </SelectItem>
                    </>
                  )}
                  {!field.required && hasMapping && (
                    <>
                      <SelectSeparator />
                      <SelectItem value={SENTINEL.CLEAR} className="text-slate-700 focus:bg-orange-50">
                        <span className="inline-flex items-center gap-2 font-normal">
                          <EraserIcon className="size-3.5 text-orange-500" />
                          {t("workspace.unify.clear_mapping")}
                        </span>
                      </SelectItem>
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
                <PencilIcon className="size-3.5" />
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
