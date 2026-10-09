"use client";

import { FileIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { TAIUnavailableReason } from "@/lib/ai/service";
import { cn } from "@/lib/cn";
import { AIUnavailableAlert } from "@/modules/ai/components/ai-unavailable-alert";
import { DraftReviewPanel } from "@/modules/survey/components/template-list/components/draft-review-panel";
import { SourceChip } from "@/modules/survey/components/template-list/components/source-chip";
import { ImportFacts } from "@/modules/survey/import/components/import-facts";
import { ImportReport } from "@/modules/survey/import/components/import-report";
import { useImportSurvey } from "@/modules/survey/import/hooks/use-import-survey";
import { getQsfImportErrorMessage } from "@/modules/survey/import/lib/import-errors";
import { QSF_FILE_EXTENSION } from "@/modules/survey/import/lib/qsf-file";
import type { TQsfImportStage } from "@/modules/survey/import/types";
import { AiIcon, AiStatusLine } from "@/modules/ui/components/ai";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { FileDropZone } from "@/modules/ui/components/file-drop-zone";

const IMPORT_STAGES: readonly TQsfImportStage[] = ["reading", "ai", "assembling"];

type ImportSurveyFormProps = {
  workspaceId: string;
  isAIAvailable: boolean;
  aiUnavailableReason?: TAIUnavailableReason;
  onSuccess: (surveyId: string) => void;
  onCancel: () => void;
  /** The host supplies the footer shell (`<DialogFooter>`); the buttons are built here, per state. */
  renderFooter: (footer: ReactNode) => ReactNode;
  /** True while the host is navigating to the editor, so the primary keeps its loading state. */
  isHostNavigating?: boolean;
  /** Reports whether closing now would discard a running import or an unopened draft. */
  onUnsavedWorkChange?: (hasUnsavedWork: boolean) => void;
  /** Reports whether an import is running, so the host can word its confirmation. */
  onImportingChange?: (isImporting: boolean) => void;
};

/**
 * The import's body: a drop zone, then the same review Create with AI shows, with the import's facts
 * and report around the question list. Mounted inside the dialog's content, so closing the dialog
 * drops its state and aborts a running import, exactly like Create with AI's form.
 */
export const ImportSurveyForm = ({
  workspaceId,
  isAIAvailable,
  aiUnavailableReason,
  onSuccess,
  onCancel,
  renderFooter,
  isHostNavigating = false,
  onUnsavedWorkChange,
  onImportingChange,
}: Readonly<ImportSurveyFormProps>) => {
  const { t } = useTranslation();
  const importer = useImportSurvey({ workspaceId, isAIAvailable, onSuccess });
  const stopButtonRef = useRef<HTMLButtonElement>(null);
  const draftRef = useRef<HTMLElement>(null);

  const isImporting = importer.status === "generating";
  const isReviewing = importer.status === "review" || importer.status === "creating";

  // The drop zone unmounts when the import starts; Stop is the only action left, so focus goes there.
  useEffect(() => {
    if (isImporting) stopButtonRef.current?.focus();
  }, [isImporting]);

  useEffect(() => {
    if (importer.status === "review") draftRef.current?.focus();
  }, [importer.status]);

  useEffect(() => {
    onUnsavedWorkChange?.(importer.hasUnsavedWork);
  }, [importer.hasUnsavedWork, onUnsavedWorkChange]);

  useEffect(() => {
    onImportingChange?.(isImporting);
  }, [isImporting, onImportingChange]);

  // Same gate as Create with AI (ENG-3603): the alert stands in for the drop zone. The route can also
  // say AI went off after the page loaded, which lands here the same way.
  if (!isAIAvailable || importer.aiUnavailableReason) {
    return (
      <AIUnavailableAlert
        title={t("workspace.surveys.import.feature_name")}
        reason={importer.aiUnavailableReason ?? aiUnavailableReason}
        feature="qsf_survey_import"
      />
    );
  }

  const errorMessage = importer.errorCode
    ? getQsfImportErrorMessage(importer.errorCode, t, importer.retryAfterSeconds)
    : null;

  const progressMessages = [
    t("workspace.surveys.import.progress.reading"),
    t("workspace.surveys.import.progress.ai"),
    t("workspace.surveys.import.progress.assembling"),
  ];
  const stageIndex = Math.max(0, importer.stage ? IMPORT_STAGES.indexOf(importer.stage) : 0);

  const sourceChip = importer.file ? (
    <SourceChip
      id="import-source-echo"
      icon={<FileIcon className="size-4" aria-hidden="true" />}
      label={importer.file.name}
      srLabel={t("workspace.surveys.import.your_file")}
      editLabel={t("workspace.surveys.import.pick_another_file")}
      disabled={importer.isCreatingSurvey}
      onEdit={importer.pickAnotherFile}
    />
  ) : null;

  const buildFooter = () => {
    if (isImporting) {
      return (
        <Button ref={stopButtonRef} type="button" variant="secondary" onClick={importer.handleStop}>
          {t("workspace.surveys.ai_create.stop")}
        </Button>
      );
    }

    if (isReviewing) {
      return (
        <>
          <Button type="button" variant="secondary" disabled={importer.isCreatingSurvey} onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={importer.isCreatingSurvey}
            onClick={importer.pickAnotherFile}>
            {t("workspace.surveys.import.pick_another_file")}
          </Button>
          <Button
            type="button"
            loading={importer.isCreatingSurvey || isHostNavigating}
            onClick={importer.handleOpenInEditor}>
            {t("workspace.surveys.ai_create.open_in_editor")}
          </Button>
        </>
      );
    }

    return (
      <Button type="button" variant="secondary" onClick={onCancel}>
        {t("common.cancel")}
      </Button>
    );
  };

  return (
    // A fixed height once the review shows: the question list scrolls inside it, so the dialog does
    // not jump as the report opens or a long import lands.
    <div
      className={cn(
        "flex min-h-0 flex-col gap-3",
        (isImporting || isReviewing) && "h-[32rem] max-h-[calc(100dvh-12rem)]"
      )}>
      {errorMessage ? (
        <Alert variant="error">
          <AlertTitle>{t("common.error")}</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {isImporting || isReviewing ? (
        <DraftReviewPanel
          draft={importer.draft}
          isGenerating={isImporting}
          source={sourceChip}
          facts={
            isReviewing && importer.report ? <ImportFacts summary={importer.report.summary} /> : undefined
          }
          report={isReviewing && importer.report ? <ImportReport report={importer.report} /> : undefined}
          status={
            isImporting ? (
              <AiStatusLine isActive messages={progressMessages} activeIndex={stageIndex} />
            ) : undefined
          }
          scrollContainerRef={draftRef}
        />
      ) : (
        <div className="flex flex-col gap-2">
          <FileDropZone
            id="import-survey-file"
            accept={QSF_FILE_EXTENSION}
            onFileSelect={importer.selectFile}
            primaryText={t("workspace.surveys.import.dropzone_primary")}
            helpText={t("workspace.surveys.import.dropzone_help")}
            loadingText={t("workspace.surveys.import.reading_file")}
          />
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <AiIcon className="size-3.5 shrink-0" aria-hidden="true" />
            {t("workspace.surveys.import.ai_note")}
          </p>
        </div>
      )}

      <div className="mt-auto">{renderFooter(buildFooter())}</div>
    </div>
  );
};
