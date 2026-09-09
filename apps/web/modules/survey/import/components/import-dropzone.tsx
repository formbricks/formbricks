"use client";

import { useTranslation } from "react-i18next";
import type { TAIUnavailableReason } from "@/lib/ai/service";
import { cn } from "@/lib/cn";
import { AIUnavailableAlert } from "@/modules/ai/components/ai-unavailable-alert";
import { getImportAcceptList } from "@/modules/survey/import/file-types";
import { getImportFormatLabel } from "@/modules/survey/import/lib/import-i18n";
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
 * The dialog's first screen: a drop zone plus the format chips, all in the same neutral style. AI formats
 * carry the AI mark and are muted when AI is unavailable; the alert then replaces the fine print (D8, screen 6).
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
            className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
            {getImportFormatLabel(format, t)}
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
      {isAIAvailable ? null : (
        <AIUnavailableAlert
          title={t("workspace.surveys.import.ai_formats_title")}
          reason={aiUnavailableReason}
          feature="ai_survey_import"
        />
      )}
    </div>
  );
};
