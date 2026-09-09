"use client";

import { FileIcon, UploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { type ReactNode, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import type { TAIUnavailableReason } from "@/lib/ai/service";
import { cn } from "@/lib/cn";
import { DraftReviewPanel } from "@/modules/survey/components/template-list/components/draft-review-panel";
import { SourceChip } from "@/modules/survey/components/template-list/components/source-chip";
import { getAiErrorMessage } from "@/modules/survey/components/template-list/lib/ai-error-messages";
import { ImportDropzone } from "@/modules/survey/import/components/import-dropzone";
import { ImportFacts } from "@/modules/survey/import/components/import-facts";
import { ImportProgressLadder } from "@/modules/survey/import/components/import-progress-ladder";
import { ImportReport } from "@/modules/survey/import/components/import-report";
import { useImportSurvey } from "@/modules/survey/import/hooks/use-import-survey";
import { formatFileSize } from "@/modules/survey/import/lib/import-file-checks";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/modules/ui/components/dialog";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";

export type TImportSurveyEntryPoint = "new_survey_menu" | "templates_card";

type ImportSurveyDialogProps = {
  workspaceId: string;
  isAIAvailable: boolean;
  /** The workspace default language, handed to the server as a detection tie-breaker. */
  languageHint?: string;
  aiUnavailableReason?: TAIUnavailableReason;
  entryPoint: TImportSurveyEntryPoint;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const capture = (event: string, properties?: Record<string, unknown>) => {
  if (posthog.__loaded) posthog.capture(event, properties);
};

/**
 * Import survey: drop a file, watch it turn into a draft, read the report, open the editor. Reuses
 * the Create-with-AI review machinery; only the first screen (a drop zone instead of a prompt) and
 * the report are import-specific. No source tabs (D8): the dialog opens on the drop zone.
 */
export const ImportSurveyDialog = ({
  workspaceId,
  isAIAvailable,
  aiUnavailableReason,
  languageHint,
  entryPoint,
  trigger,
  open,
  onOpenChange,
}: Readonly<ImportSurveyDialogProps>) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const [isNavigating, startEditorNavigationTransition] = useTransition();
  const [isConfirmingDiscard, setIsConfirmingDiscard] = useState(false);
  const draftRef = useRef<HTMLElement>(null);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;

  const handleSuccess = (surveyId: string) => {
    capture("survey_import_created", { entry_point: entryPoint });
    startEditorNavigationTransition(() => {
      router.push(`/workspaces/${workspaceId}/surveys/${surveyId}/edit`);
    });
  };

  const importer = useImportSurvey({ workspaceId, isAIAvailable, languageHint, onSuccess: handleSuccess });
  const isConverting = importer.status === "generating";
  const isReviewing = importer.status === "review" || importer.status === "creating";

  useEffect(() => {
    if (isOpen) capture("survey_import_dialog_opened", { entry_point: entryPoint });
  }, [entryPoint, isOpen]);

  useEffect(() => {
    if (importer.status === "review") draftRef.current?.focus();
  }, [importer.status]);

  const commitOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) setInternalOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange]
  );

  const setDialogOpen = (nextOpen: boolean) => {
    if (isNavigating && !nextOpen) return;
    if (!nextOpen && importer.hasUnsavedWork) {
      setIsConfirmingDiscard(true);
      return;
    }
    commitOpenChange(nextOpen);
  };

  const handleFileSelect = (file: File) => {
    capture("survey_import_source_selected", {
      extension: file.name.split(".").pop()?.toLowerCase() ?? null,
    });
    importer.selectFile(file);
  };

  const handleStop = () => {
    capture("survey_import_stopped");
    importer.handleStop();
  };

  const handleRegenerate = () => {
    capture("survey_import_regenerated");
    importer.handleRegenerate();
  };

  const fileCheckMessage = importer.fileCheck ? getAiErrorMessage(importer.fileCheck, t) : null;
  const errorMessage = importer.errorMessage ?? fileCheckMessage;

  const sourceChip = importer.file ? (
    <SourceChip
      id="import-source-echo"
      icon={<FileIcon className="size-4" aria-hidden="true" />}
      label={importer.sourceLabel || importer.file.name}
      detail={formatFileSize(importer.file.size)}
      srLabel={t("workspace.surveys.import.your_file")}
      editLabel={t("workspace.surveys.import.pick_another_file")}
      disabled={importer.isCreatingSurvey}
      onEdit={importer.pickAnotherFile}
    />
  ) : null;

  const buildFooter = () => {
    if (isConverting) {
      return (
        <Button type="button" variant="secondary" onClick={handleStop}>
          {t("workspace.surveys.ai_create.stop")}
        </Button>
      );
    }

    if (isReviewing) {
      return (
        <>
          <Button
            type="button"
            variant="secondary"
            disabled={importer.isCreatingSurvey}
            onClick={importer.pickAnotherFile}>
            {t("workspace.surveys.import.pick_another_file")}
          </Button>
          {importer.canRegenerate ? (
            <Button
              type="button"
              variant="ai-secondary"
              disabled={importer.isCreatingSurvey}
              onClick={handleRegenerate}>
              {t("workspace.surveys.import.read_again")}
            </Button>
          ) : null}
          <Button
            type="button"
            loading={importer.isCreatingSurvey || isNavigating}
            disabled={importer.name.trim().length === 0}
            onClick={importer.handleOpenInEditor}>
            {t("workspace.surveys.import.open_in_editor")}
          </Button>
        </>
      );
    }

    return (
      <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
        {t("common.cancel")}
      </Button>
    );
  };

  const reviewReport = importer.report;

  return (
    <Dialog open={isOpen} onOpenChange={setDialogOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent
        width={isReviewing ? "wide" : "default"}
        className="overflow-hidden"
        disableCloseOnOutsideClick
        closeOnEscape>
        <DialogHeader>
          <UploadIcon aria-hidden="true" />
          <DialogTitle>{t("workspace.surveys.import.title")}</DialogTitle>
          <DialogDescription>{t("workspace.surveys.import.description")}</DialogDescription>
        </DialogHeader>

        <DialogBody
          unconstrained
          className={cn(
            "-mx-1 -mt-1 flex flex-none flex-col gap-4 px-1 pt-1 pb-1",
            isReviewing && "h-[32rem]"
          )}>
          {errorMessage ? (
            <Alert variant="error">
              <AlertTitle>{t("common.error")}</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          {isConverting || isReviewing ? (
            <>
              <DraftReviewPanel
                draft={importer.draft}
                isGenerating={isConverting}
                source={sourceChip}
                facts={
                  isReviewing && reviewReport ? (
                    <ImportFacts summary={reviewReport.summary} source={reviewReport.source} />
                  ) : undefined
                }
                report={
                  isReviewing && reviewReport ? <ImportReport issues={reviewReport.issues} /> : undefined
                }
                status={
                  isConverting ? <ImportProgressLadder progress={importer.progress} isActive /> : undefined
                }
                scrollContainerRef={draftRef}
              />
              {isReviewing ? (
                <div className="flex shrink-0 items-center gap-3">
                  <Label htmlFor="import-survey-name" className="shrink-0">
                    {t("workspace.surveys.import.survey_name")}
                  </Label>
                  <Input
                    id="import-survey-name"
                    value={importer.name}
                    onChange={(event) => importer.setName(event.target.value)}
                    disabled={importer.isCreatingSurvey}
                    maxLength={200}
                  />
                </div>
              ) : null}
            </>
          ) : (
            <>
              <ImportDropzone
                onFileSelect={handleFileSelect}
                isAIAvailable={isAIAvailable}
                aiUnavailableReason={aiUnavailableReason}
              />
              {importer.fatalReport ? (
                <ImportReport issues={importer.fatalReport.issues} defaultOpen />
              ) : null}
            </>
          )}

          <div className="mt-auto">
            <DialogFooter>{buildFooter()}</DialogFooter>
          </div>
        </DialogBody>
      </DialogContent>

      <ConfirmationModal
        open={isConfirmingDiscard}
        setOpen={setIsConfirmingDiscard}
        title={
          isConverting
            ? t("workspace.surveys.import.discard_converting_title")
            : t("workspace.surveys.import.discard_title")
        }
        body={
          isConverting
            ? t("workspace.surveys.import.discard_converting_body")
            : t("workspace.surveys.import.discard_body")
        }
        buttonText={t("workspace.surveys.ai_create.discard")}
        buttonVariant="destructive"
        cancelButtonText={t("workspace.surveys.ai_create.keep_editing")}
        onConfirm={() => {
          setIsConfirmingDiscard(false);
          importer.handleStop();
          commitOpenChange(false);
        }}
      />
    </Dialog>
  );
};
