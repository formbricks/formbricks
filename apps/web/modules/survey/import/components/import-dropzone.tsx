"use client";

import { useTranslation } from "react-i18next";
import type { TAIUnavailableReason } from "@/lib/ai/service";
import { cn } from "@/lib/cn";
import { AIUnavailableAlert } from "@/modules/ai/components/ai-unavailable-alert";
import { getImportAcceptList } from "@/modules/survey/import/file-types";
import { AiIcon } from "@/modules/ui/components/ai";
import { FileDropZone } from "@/modules/ui/components/file-drop-zone";

type ImportDropzoneProps = {
  onFileSelect: (file: File) => void;
  isAIAvailable: boolean;
  aiUnavailableReason?: TAIUnavailableReason;
  disabled?: boolean;
};

const DETERMINISTIC_FORMATS = ["formbricks", "qsf"] as const;
const AI_FORMATS = ["docx", "pdf", "markdown", "csv", "xlsx"] as const;

/**
 * The dialog's first screen: a drop zone plus the format chips. AI formats carry the AI mark and
 * are muted when AI is unavailable; the AI-unavailable alert then replaces the fine print (D8, screen 6).
 */
export const ImportDropzone = ({
  onFileSelect,
  isAIAvailable,
  aiUnavailableReason,
  disabled = false,
}: Readonly<ImportDropzoneProps>) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3">
      <FileDropZone
        id="import-survey-file"
        accept={getImportAcceptList().join(",")}
        onFileSelect={onFileSelect}
        disabled={disabled}
        primaryText={t("workspace.surveys.import.dropzone_primary")}
        secondaryText={t("workspace.surveys.import.dropzone_secondary")}
        helpText={t("workspace.surveys.import.dropzone_help")}
      />
      <ul className="flex flex-wrap gap-1.5" aria-label={t("workspace.surveys.import.formats_label")}>
        {DETERMINISTIC_FORMATS.map((format) => (
          <li
            key={format}
            className={cn(
              "rounded-md border px-2 py-0.5 text-xs",
              format === "formbricks"
                ? "border-green-600 bg-green-50 text-green-800"
                : "border-slate-200 bg-slate-50 text-slate-600"
            )}>
            {t(`workspace.surveys.import.format_${format}`)}
          </li>
        ))}
        {AI_FORMATS.map((format) => (
          <li
            key={format}
            className={cn(
              "flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs",
              isAIAvailable
                ? "border-slate-200 bg-slate-50 text-slate-600"
                : "border-slate-100 text-slate-400"
            )}>
            <AiIcon
              tone={isAIAvailable ? "inherit" : undefined}
              className={cn("size-3", !isAIAvailable && "opacity-50")}
            />
            {t(`workspace.surveys.import.format_${format}`)}
          </li>
        ))}
      </ul>
      {isAIAvailable ? (
        <p className="text-xs text-slate-500">{t("workspace.surveys.import.ai_formats_hint")}</p>
      ) : (
        <AIUnavailableAlert
          title={t("workspace.surveys.import.ai_formats_title")}
          reason={aiUnavailableReason}
          feature="ai_survey_import"
        />
      )}
    </div>
  );
};
