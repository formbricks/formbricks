"use client";

import { ClockIcon, EraserIcon, PencilIcon, SparklesIcon, TextCursorInputIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import {
  InputCombobox,
  TComboboxGroupedOption,
  TComboboxOption,
} from "@/modules/ui/components/input-combo-box";
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

  // A single grouped option-set drives the picker. InputCombobox's validOptions uses the flat
  // `options` prop exclusively when it is non-empty and otherwise falls back to groupedOptions, so
  // everything (columns, enum values, actions) must live in ONE source or a selected value won't
  // resolve for display. We keep it all in groupedOptions and pass an empty flat `options`.
  const comboboxGroupedOptions = useMemo((): TComboboxGroupedOption[] => {
    const groups: TComboboxGroupedOption[] = [];

    // CSV columns are mappable for every field type — including enum, where a column carries the
    // per-row enum value (this is what auto-mapping produces, e.g. field_type -> the "type" column).
    if (sourceFields.length > 0) {
      groups.push({
        label: t("workspace.unify.csv_columns"),
        value: "csv-columns",
        options: sourceFields.map((column) => {
          const sampleValue = column.sampleValue?.trim();
          const otherUsage = otherUsageByColumn[column.id];
          const meta: Record<string, string> = {};

          if (sampleValue) {
            meta.hint = t("workspace.unify.csv_first_value", { value: truncate(sampleValue, 48) });
          }
          if (otherUsage) {
            meta.badge = t("workspace.unify.csv_column_used_by", { target: otherUsage });
          }

          return {
            value: `${SENTINEL.COLUMN_PREFIX}${column.id}`,
            label: column.name,
            meta: Object.keys(meta).length > 0 ? meta : undefined,
          };
        }),
      });
    }

    // Enum fields also offer their allowed values as static picks.
    if (isEnum && field.enumValues?.length) {
      groups.push({
        label: t("workspace.unify.enum"),
        value: "enum-values",
        options: field.enumValues.map((enumValue) => ({
          value: `${SENTINEL.ENUM_PREFIX}${enumValue}`,
          label: enumValue,
        })),
      });
    }

    const actionOptions: TComboboxOption[] = [];

    // "Set to now" and free-text fixed values only apply to non-enum fields.
    if (!isEnum) {
      if (isTimestamp) {
        actionOptions.push({
          value: SENTINEL.STATIC_NOW,
          label: t("workspace.unify.csv_now_label"),
          icon: ClockIcon,
        });
      }

      actionOptions.push({
        value: SENTINEL.EDIT_FIXED,
        label:
          mapping?.staticValue && mapping.staticValue !== "$now"
            ? t("workspace.unify.csv_fixed_value_label", {
                value: truncate(mapping.staticValue, 40),
              })
            : t("workspace.unify.csv_fixed_value_action"),
        icon: TextCursorInputIcon,
      });
    }

    if (!field.required && hasMapping) {
      actionOptions.push({
        value: SENTINEL.CLEAR,
        label: t("workspace.unify.clear_mapping"),
        icon: EraserIcon,
      });
    }

    if (actionOptions.length > 0) {
      groups.push({
        label: t("common.actions"),
        value: "actions",
        options: actionOptions,
      });
    }

    return groups;
  }, [
    field.enumValues,
    field.required,
    hasMapping,
    isEnum,
    isTimestamp,
    mapping?.staticValue,
    otherUsageByColumn,
    sourceFields,
    t,
  ]);

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
        <span className="text-sm font-medium text-slate-800">{field.name}</span>
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
            <div className="min-w-0 flex-1">
              <InputCombobox
                id={`csv-mapping-${field.id}`}
                value={selectValue || null}
                options={[]}
                groupedOptions={comboboxGroupedOptions}
                onChangeValue={(value) => {
                  if (typeof value === "string") {
                    handleSelectChange(value);
                  }
                }}
                placeholder={
                  isEnum
                    ? t("workspace.unify.select_a_value")
                    : t("workspace.unify.csv_pick_column_placeholder")
                }
                searchPlaceholder={t("common.search")}
                emptyDropdownText={t("workspace.surveys.edit.no_option_found")}
                showSearch={!isEnum}
                comboboxClasses="h-9 w-full max-w-none [&_[role=combobox]]:h-9"
              />
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
