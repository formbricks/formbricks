"use client";

import { PlayIcon, RefreshCwIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import type { TaxonomyFieldOption } from "@/modules/hub/types";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { fieldKey, sourceKey } from "../lib/scope";

interface TaxonomyControlsProps {
  directoryMap: Record<string, string>;
  directoryIds: string[];
  directoryId: string;
  onDirectoryChange: (id: string) => void;
  sourceOptions: TaxonomyFieldOption[];
  selectedSourceKey: string;
  onSourceChange: (key: string) => void;
  filteredFields: TaxonomyFieldOption[];
  selectedFieldKey: string;
  onFieldChange: (key: string) => void;
  selectedField: TaxonomyFieldOption | null;
  isLoadingFields: boolean;
  hasActiveTree: boolean;
  canGenerate: boolean;
  isGenerating: boolean;
  onGenerate: () => void;
  canWrite: boolean;
  viewMode: "view" | "edit";
  onViewModeChange: (mode: "view" | "edit") => void;
}

const Selector = ({ label, children }: Readonly<{ label: string; children: ReactNode }>) => (
  <label className="min-w-0 flex-1 space-y-1">
    <span className="block text-xs font-medium text-slate-600">{label}</span>
    {children}
  </label>
);

export const TaxonomyControls = ({
  directoryMap,
  directoryIds,
  directoryId,
  onDirectoryChange,
  sourceOptions,
  selectedSourceKey,
  onSourceChange,
  filteredFields,
  selectedFieldKey,
  onFieldChange,
  selectedField,
  isLoadingFields,
  hasActiveTree,
  canGenerate,
  isGenerating,
  onGenerate,
  canWrite,
  viewMode,
  onViewModeChange,
}: Readonly<TaxonomyControlsProps>) => {
  const { t } = useTranslation();
  const [isRegenerateConfirmOpen, setIsRegenerateConfirmOpen] = useState(false);

  const handleGenerateClick = () => {
    if (hasActiveTree) {
      setIsRegenerateConfirmOpen(true);
    } else {
      onGenerate();
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        {/* A workspace is limited to a single dataset; the picker only appears in the defensive
         * case of more than one. */}
        {directoryIds.length > 1 && (
          <Selector label={t("workspace.unify.feedback_directory")}>
            <Select value={directoryId} onValueChange={onDirectoryChange} disabled={isLoadingFields}>
              <SelectTrigger>
                <SelectValue placeholder={t("workspace.unify.select_feedback_directory")} />
              </SelectTrigger>
              <SelectContent>
                {directoryIds.map((id) => (
                  <SelectItem key={id} value={id}>
                    {directoryMap[id]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Selector>
        )}

        <Selector label={t("workspace.unify.taxonomy_source")}>
          <Select
            value={selectedSourceKey}
            onValueChange={onSourceChange}
            disabled={sourceOptions.length === 0 || isLoadingFields}>
            <SelectTrigger>
              <SelectValue placeholder={t("workspace.unify.taxonomy_select_source")} />
            </SelectTrigger>
            <SelectContent>
              {sourceOptions.map((field) => (
                <SelectItem key={sourceKey(field)} value={sourceKey(field)}>
                  {field.source_name || field.source_id || t("workspace.unify.taxonomy_no_source")} (
                  {field.source_type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Selector>

        <Selector label={t("workspace.unify.taxonomy_field")}>
          <Select
            value={selectedFieldKey}
            onValueChange={onFieldChange}
            disabled={filteredFields.length === 0 || isLoadingFields}>
            <SelectTrigger>
              <SelectValue placeholder={t("workspace.unify.taxonomy_select_field")} />
            </SelectTrigger>
            <SelectContent>
              {filteredFields.map((field) => (
                <SelectItem key={fieldKey(field)} value={fieldKey(field)}>
                  {field.field_label || field.field_id} ({field.embedding_count}/{field.record_count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Selector>

        <div className="flex shrink-0 items-center gap-2">
          {canWrite && hasActiveTree && (
            <div className="inline-flex rounded-md border border-slate-200 p-0.5">
              {(["view", "edit"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={cn(
                    "rounded px-3 py-1 text-sm font-medium transition-colors",
                    viewMode === mode ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                  )}
                  onClick={() => onViewModeChange(mode)}>
                  {mode === "view"
                    ? t("workspace.unify.taxonomy_view_mode")
                    : t("workspace.unify.taxonomy_edit_mode")}
                </button>
              ))}
            </div>
          )}

          <Button
            type="button"
            className="h-9"
            disabled={!canGenerate}
            loading={isGenerating}
            onClick={handleGenerateClick}>
            {hasActiveTree ? <RefreshCwIcon className="size-4" /> : <PlayIcon className="size-4" />}
            {hasActiveTree
              ? t("workspace.unify.taxonomy_regenerate")
              : t("workspace.unify.taxonomy_generate")}
          </Button>
        </div>
      </div>

      {selectedField && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
          <Badge
            text={t("workspace.unify.taxonomy_embedded_records_short", {
              count: selectedField.embedding_count,
            })}
            type="gray"
            size="tiny"
          />
          <Badge
            text={t("workspace.unify.taxonomy_text_records_short", { count: selectedField.record_count })}
            type="gray"
            size="tiny"
          />
          {!canWrite && <Badge text={t("workspace.unify.taxonomy_read_only")} type="warning" size="tiny" />}
        </div>
      )}

      <ConfirmationModal
        open={isRegenerateConfirmOpen}
        setOpen={setIsRegenerateConfirmOpen}
        title={t("workspace.unify.taxonomy_regenerate_confirm_title")}
        description={t("workspace.unify.taxonomy_regenerate_confirm_description")}
        body={t("workspace.unify.taxonomy_regenerate_confirm_body")}
        buttonText={t("workspace.unify.taxonomy_regenerate")}
        buttonVariant="default"
        onConfirm={() => {
          setIsRegenerateConfirmOpen(false);
          onGenerate();
        }}
      />
    </div>
  );
};
