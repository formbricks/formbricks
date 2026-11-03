"use client";

import type { TFunction } from "i18next";
import { ArrowUpRightIcon, FileIcon } from "lucide-react";
import { type ReactNode, type RefObject, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { DraftReviewPanel } from "@/modules/survey/components/template-list/components/draft-review-panel";
import { SourceChip } from "@/modules/survey/components/template-list/components/source-chip";
import { ImportFacts } from "@/modules/survey/import/components/import-facts";
import { ImportFieldProblems } from "@/modules/survey/import/components/import-field-problems";
import { ImportMatchChoice } from "@/modules/survey/import/components/import-match-choice";
import { ImportReport } from "@/modules/survey/import/components/import-report";
import { useImportSurvey } from "@/modules/survey/import/hooks/use-import-survey";
import { getSurveyImportErrorMessage } from "@/modules/survey/import/lib/import-errors";
import { getSurveyImportFileExtensions } from "@/modules/survey/import/lib/import-file";
import { getSwitchedOffLanguages } from "@/modules/survey/import/lib/import-report";
import type { TSurveyImportReport, TSurveyImportStage } from "@/modules/survey/import/types";
import { AiIcon, AiStatusLine } from "@/modules/ui/components/ai";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { FileDropZone } from "@/modules/ui/components/file-drop-zone";

const IMPORT_STAGES: readonly TSurveyImportStage[] = ["reading", "ai", "assembling"];

/**
 * Where the "Very large survey?" hint points: the import docs' section on importing through MCP with an
 * AI assistant, which says when a document is too large and links on to connecting the assistant.
 */
const MCP_DOCS_URL = "https://formbricks.com/docs/surveys/import-export/overview#very-large-surveys";

type ImportSurveyFormProps = {
  workspaceId: string;
  /** Whether Formbricks AI can read a Qualtrics export here; a Formbricks file imports either way. */
  isAIAvailable: boolean;
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
 * Languages with missing texts import switched off. Said above the save button, not only in the report:
 * the survey publishes without them and nothing else stops it.
 */
const SwitchedOffLanguagesAlert = ({ report }: Readonly<{ report: TSurveyImportReport }>) => {
  const { t } = useTranslation();
  const languages = getSwitchedOffLanguages(report);
  if (languages.length === 0) return null;

  return (
    <Alert variant="warning">
      <AlertTitle>
        {t("workspace.surveys.import.languages_off_title", { count: languages.length })}
      </AlertTitle>
      <AlertDescription>
        {t("workspace.surveys.import.languages_off_description", {
          count: languages.length,
          languages: languages.join(", "),
        })}
      </AlertDescription>
    </Alert>
  );
};

/**
 * The import's body: a drop zone, then the same review Create with AI shows, with the import's facts
 * and report around the question list. Mounted inside the dialog's content, so closing the dialog
 * drops its state and aborts a running import, exactly like Create with AI's form.
 */
type TImportSurvey = ReturnType<typeof useImportSurvey>;

/**
 * What the review shows: the finished import's report while there is one, and the draft. An Update adds
 * to the report what it removes from a survey with responses, and keeps the matched survey's name; only
 * a new survey takes the draft's "<name> (imported)".
 */
const getReview = ({ report, match, choice, draft }: TImportSurvey, isReviewing: boolean) => {
  const updated = match !== null && choice === "update" ? match : null;
  return {
    reviewReport:
      isReviewing && report
        ? { ...report, issues: updated ? [...updated.issues, ...report.issues] : report.issues }
        : null,
    reviewDraft: updated ? { ...draft, name: updated.name } : draft,
  };
};

/** The drop zone, before a file is chosen: what it takes, and where a very large survey goes instead. */
const ImportFilePicker = ({
  canReadWithAI,
  onFileSelect,
}: Readonly<{ canReadWithAI: boolean; onFileSelect: TImportSurvey["selectFile"] }>) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <FileDropZone
        id="import-survey-file"
        accept={getSurveyImportFileExtensions(canReadWithAI).join(",")}
        onFileSelect={onFileSelect}
        primaryText={t("workspace.surveys.import.dropzone_primary")}
        helpText={
          canReadWithAI
            ? t("workspace.surveys.import.dropzone_help")
            : t("workspace.surveys.import.dropzone_help_json_only")
        }
        loadingText={t("workspace.surveys.import.reading_file")}
      />
      {canReadWithAI ? (
        <p className="flex items-center gap-1.5 text-xs text-slate-500">
          <AiIcon className="size-3.5 shrink-0" aria-hidden="true" />
          {t("workspace.surveys.import.ai_note")}
        </p>
      ) : null}
      <p className="text-xs text-slate-500">
        {t("workspace.surveys.import.mcp_hint")}{" "}
        <a
          href={MCP_DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-slate-600 underline underline-offset-4 hover:text-slate-800">
          {t("workspace.surveys.import.mcp_hint_link")}
          <ArrowUpRightIcon className="size-3" aria-hidden="true" />
        </a>
      </p>
    </div>
  );
};

/**
 * On a Match the primary button says what it does: Update, "Update anyway" once the survey turned out
 * to have changed since the export, or the usual Save and continue for a new survey.
 */
const getPrimaryAction = (importer: TImportSurvey, t: TFunction): { label: string; testId: string } => {
  if (importer.match === null || importer.choice !== "update") {
    return { label: t("workspace.surveys.ai_create.open_in_editor"), testId: "survey-import-save" };
  }
  return importer.conflict === "stale"
    ? { label: t("workspace.surveys.import.match.update_anyway"), testId: "survey-import-update-anyway" }
    : { label: t("workspace.surveys.import.match.update_survey"), testId: "survey-import-update" };
};

/** The dialog's buttons: Stop while importing; Cancel, another file and the primary action in review. */
const ImportFooter = ({
  importer,
  isImporting,
  isReviewing,
  isHostNavigating,
  onCancel,
  stopButtonRef,
}: Readonly<{
  importer: TImportSurvey;
  isImporting: boolean;
  isReviewing: boolean;
  isHostNavigating: boolean;
  onCancel: () => void;
  stopButtonRef: RefObject<HTMLButtonElement | null>;
}>) => {
  const { t } = useTranslation();

  if (isImporting) {
    return (
      <Button ref={stopButtonRef} type="button" variant="secondary" onClick={importer.handleStop}>
        {t("workspace.surveys.ai_create.stop")}
      </Button>
    );
  }

  if (!isReviewing) {
    return (
      <Button type="button" variant="secondary" onClick={onCancel}>
        {t("common.cancel")}
      </Button>
    );
  }

  const primary = getPrimaryAction(importer, t);
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
        onClick={importer.handleOpenInEditor}
        data-testid={primary.testId}>
        {primary.label}
      </Button>
    </>
  );
};

export const ImportSurveyForm = ({
  workspaceId,
  isAIAvailable,
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
  const isUpdating = importer.match !== null && importer.choice === "update";
  const { reviewReport, reviewDraft } = getReview(importer, isReviewing);

  // The drop zone unmounts when the import starts; Stop is the only action left, so focus goes there.
  useEffect(() => {
    if (isImporting) stopButtonRef.current?.focus();
  }, [isImporting]);

  // preventScroll: in a short dialog the review body scrolls, and focusing the list would scroll the
  // file name out of view the moment the review opens.
  useEffect(() => {
    if (importer.status === "review") draftRef.current?.focus({ preventScroll: true });
  }, [importer.status]);

  useEffect(() => {
    onUnsavedWorkChange?.(importer.hasUnsavedWork);
  }, [importer.hasUnsavedWork, onUnsavedWorkChange]);

  useEffect(() => {
    onImportingChange?.(isImporting);
  }, [isImporting, onImportingChange]);

  // Without Formbricks AI the dialog still imports Formbricks files (ENG-6850), so there is no alert in
  // place of the drop zone: it offers .json only and leaves the AI note out. AI going off after the page
  // loaded refuses the .qsf it was asked to read, with an error line like any other refusal.
  const canReadWithAI = isAIAvailable && !importer.aiUnavailableReason;

  const errorMessage = importer.errorCode
    ? getSurveyImportErrorMessage(importer.errorCode, t, importer.retryAfterSeconds)
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
          <AlertDescription>
            {errorMessage}
            <ImportFieldProblems problems={importer.invalidParams ?? []} />
          </AlertDescription>
        </Alert>
      ) : null}

      {isImporting || isReviewing ? (
        // The report and the languages warning can fill a short dialog. Then this part scrolls and the
        // list keeps two rows instead of shrinking to nothing, while the warning and the footer stay
        // in view. -m-1/p-1 leave room for focus rings the scroll box would otherwise clip.
        <div className="-m-1 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-1">
          {isReviewing && importer.match ? (
            <ImportMatchChoice
              match={importer.match}
              newSurveyName={importer.newSurveyName}
              choice={importer.choice}
              onChoiceChange={importer.selectChoice}
              triggersChoice={importer.triggersChoice}
              onTriggersChoiceChange={importer.selectTriggersChoice}
              conflict={importer.conflict}
            />
          ) : null}
          <DraftReviewPanel
            draft={reviewDraft}
            isGenerating={isImporting}
            source={sourceChip}
            facts={reviewReport ? <ImportFacts summary={reviewReport.summary} /> : undefined}
            report={
              reviewReport ? (
                // Remounted with the choice, so it opens by itself when an Update adds a warning.
                <ImportReport key={isUpdating ? "update" : "create"} report={reviewReport} />
              ) : undefined
            }
            status={
              isImporting ? (
                <AiStatusLine isActive messages={progressMessages} activeIndex={stageIndex} />
              ) : undefined
            }
            scrollContainerRef={draftRef}
            listClassName="min-h-48"
          />
        </div>
      ) : (
        <ImportFilePicker canReadWithAI={canReadWithAI} onFileSelect={importer.selectFile} />
      )}

      {reviewReport ? <SwitchedOffLanguagesAlert report={reviewReport} /> : null}

      <div className="mt-auto">
        {renderFooter(
          <ImportFooter
            importer={importer}
            isImporting={isImporting}
            isReviewing={isReviewing}
            isHostNavigating={isHostNavigating}
            onCancel={onCancel}
            stopButtonRef={stopButtonRef}
          />
        )}
      </div>
    </div>
  );
};
