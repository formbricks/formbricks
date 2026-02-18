"use client";

import { useTranslation } from "react-i18next";
import { Badge } from "@/modules/ui/components/badge";
import { TSourceType, getSourceOptions } from "../types";

interface SourceTypeSelectorProps {
  selectedType: TSourceType | null;
  onSelectType: (type: TSourceType) => void;
}

export function SourceTypeSelector({ selectedType, onSelectType }: SourceTypeSelectorProps) {
  const { t } = useTranslation();
  const sourceOptions = getSourceOptions(t);

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">{t("environments.unify.select_source_type_prompt")}</p>
      <div className="space-y-2">
        {sourceOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={option.disabled}
            onClick={() => onSelectType(option.id)}
            className={`flex w-full items-center justify-between rounded-lg border p-4 text-left transition-colors ${
              selectedType === option.id
                ? "border-brand-dark bg-slate-50"
                : option.disabled
                  ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900">{option.name}</span>
                {option.badge && <Badge text={option.badge.text} type={option.badge.type} size="tiny" />}
              </div>
              <p className="mt-1 text-sm text-slate-500">{option.description}</p>
            </div>
            <div
              className={`ml-4 h-5 w-5 rounded-full border-2 ${
                selectedType === option.id ? "border-brand-dark bg-brand-dark" : "border-slate-300"
              }`}>
              {selectedType === option.id && (
                <div className="flex h-full w-full items-center justify-center">
                  <div className="h-2 w-2 rounded-full bg-white" />
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
