"use client";

import { ArrowUpRightIcon, FileIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { DraftReviewPanel } from "@/modules/survey/components/template-list/components/draft-review-panel";
import { SourceChip } from "@/modules/survey/components/template-list/components/source-chip";
import { ImportFacts } from "@/modules/survey/import/components/import-facts";
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

const MAX_LISTED_PROBLEMS = 10;

const IMPORT_STAGES: readonly TSurveyImportStage[] = ["reading", "ai", "assembling"];

/** Where the "Very large survey?" hint points: importing through MCP with an AI assistant. */
const MCP_DOCS_URL = "https://formbricks.com/docs/platform/mcp/overview";

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
  // The finished import's report, while the review shows it. An Update adds what it removes from a
  // survey with responses.
  const reviewReport =
    isReviewing && importer.report
      ? {
          ...importer.report,
          issues: isUpdating
            ? [...(importer.match?.issues ?? []), ...importer.report.issues]
            : importer.report.issues,
        }
      : null;

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
  const fileExtensions = getSurveyImportFileExtensions(canReadWithAI);
  // At most this many field problems are listed; the rest are counted.
  const shownInvalidParams = importer.invalidParams?.slice(0, MAX_LISTED_PROBLEMS) ?? [];
  const unlistedProblemCount = (importer.invalidParams?.length ?? 0) - shownInvalidParams.length;

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

  // On a Match the primary button says what it does: Update, "Update anyway" once the survey turned out
  // to have changed since the export, or the usual Save and continue for a new survey.
  const getPrimaryLabel = () => {
    if (!isUpdating) return t("workspace.surveys.ai_create.open_in_editor");
    return importer.conflict === "stale"
      ? t("workspace.surveys.import.match.update_anyway")
      : t("workspace.surveys.import.match.update_survey");
  };
  const getPrimaryTestId = () => {
    if (!isUpdating) return "survey-import-save";
    return importer.conflict === "stale" ? "survey-import-update-anyway" : "survey-import-update";
  };

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
            onClick={importer.handleOpenInEditor}
            data-testid={getPrimaryTestId()}>
            {getPrimaryLabel()}
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
          <AlertDescription>
            {errorMessage}
            {shownInvalidParams.length > 0 ? (
              // Field paths and reasons come from the user's file: rendered as text only.
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {shownInvalidParams.map((param, index) => (
                  <li key={`${param.name}-${index}`} className="break-words">
                    <code className="text-xs">{param.name}</code>: {param.reason}
                  </li>
                ))}
                {unlistedProblemCount > 0 ? (
                  <li>
                    {t("workspace.surveys.import.errors.more_problems", { count: unlistedProblemCount })}
                  </li>
                ) : null}
              </ul>
            ) : null}
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
            draft={importer.draft}
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
        <div className="flex flex-col gap-2">
          <FileDropZone
            id="import-survey-file"
            accept={fileExtensions.join(",")}
            onFileSelect={importer.selectFile}
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
      )}

      {reviewReport ? <SwitchedOffLanguagesAlert report={reviewReport} /> : null}

      <div className="mt-auto">{renderFooter(buildFooter())}</div>
    </div>
  );
};
