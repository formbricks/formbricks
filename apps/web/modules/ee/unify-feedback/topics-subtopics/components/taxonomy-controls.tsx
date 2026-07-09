"use client";

import { PlayIcon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
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

interface TaxonomyControlsProps {
  directoryMap: Record<string, string>;
  directoryIds: string[];
  directoryId: string;
  onDirectoryChange: (id: string) => void;
  /** Whole-directory totals shown alongside the generate action. */
  embeddedCount: number;
  textRecordCount: number;
  isLoadingFields: boolean;
  hasActiveTree: boolean;
  canGenerate: boolean;
  isGenerating: boolean;
  onGenerate: () => void;
  canWrite: boolean;
}

export const TaxonomyControls = ({
  directoryMap,
  directoryIds,
  directoryId,
  onDirectoryChange,
  embeddedCount,
  textRecordCount,
  isLoadingFields,
  hasActiveTree,
  canGenerate,
  isGenerating,
  onGenerate,
  canWrite,
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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <Badge
          text={t("workspace.unify.taxonomy_embedded_records_short", { count: embeddedCount })}
          type="gray"
          size="tiny"
        />
        <Badge
          text={t("workspace.unify.taxonomy_text_records_short", { count: textRecordCount })}
          type="gray"
          size="tiny"
        />
        {!canWrite && <Badge text={t("workspace.unify.taxonomy_read_only")} type="warning" size="tiny" />}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {/* A workspace is limited to a single dataset; the picker only appears in the defensive
         * case of more than one. */}
        {directoryIds.length > 1 && (
          <Select value={directoryId} onValueChange={onDirectoryChange} disabled={isLoadingFields}>
            <SelectTrigger className="w-56 [&>span]:min-w-0 [&>span]:truncate">
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
        )}

        <Button
          type="button"
          className="h-9"
          disabled={!canGenerate}
          loading={isGenerating}
          onClick={handleGenerateClick}>
          {hasActiveTree ? <RefreshCwIcon className="size-4" /> : <PlayIcon className="size-4" />}
          {hasActiveTree ? t("workspace.unify.taxonomy_regenerate") : t("workspace.unify.taxonomy_generate")}
        </Button>
      </div>

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
