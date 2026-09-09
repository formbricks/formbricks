"use client";

import { useCallback, useRef, useState } from "react";
import type { TSurveyImportStreamEvent } from "@/app/api/internal/surveys/import/lib/events";
import type { TSurveyExportReferences } from "@/app/api/v3/surveys/export/schemas";
import type { TV3CreateSurveyBody } from "@/app/api/v3/surveys/schemas";
import {
  type TDraftStreamHandlers,
  useDraftCreation,
} from "@/modules/survey/components/template-list/hooks/use-draft-creation";
import { documentToDraftSnapshot } from "@/modules/survey/import/lib/draft-snapshot";
import { createImportedSurvey } from "@/modules/survey/import/lib/import-client";
import { type TImportFileCheckCode, checkImportFile } from "@/modules/survey/import/lib/import-file-checks";
import {
  INITIAL_IMPORT_PROGRESS,
  type TImportProgressState,
  reduceImportProgress,
} from "@/modules/survey/import/lib/import-progress";
import {
  buildImportFormData,
  streamImportConversion,
} from "@/modules/survey/import/lib/import-stream-client";
import { getDocumentName, getImportedSurveyName } from "@/modules/survey/import/lib/imported-survey-name";
import type { TImportReport } from "@/modules/survey/import/types";

type UseImportSurveyProps = {
  workspaceId: string;
  isAIAvailable: boolean;
  /** The workspace default language; breaks language-detection ties for documents. */
  languageHint?: string;
  onSuccess: (surveyId: string) => void;
};

/**
 * Import survey: a file in, a reviewed draft out. Built on the same machine Create with AI uses; this
 * hook supplies the file state, the resolve call (dry run or convert) and the create call through the
 * import route.
 */
export const useImportSurvey = ({
  workspaceId,
  isAIAvailable,
  languageHint,
  onSuccess,
}: UseImportSurveyProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<TImportProgressState>(INITIAL_IMPORT_PROGRESS);
  const [fileCheck, setFileCheck] = useState<TImportFileCheckCode | null>(null);
  const [name, setName] = useState("");
  /** The report of a run that produced no document: shown under the error so the reasons are visible. */
  const [fatalReport, setFatalReport] = useState<TImportReport | null>(null);
  const referencesRef = useRef<TSurveyExportReferences | null>(null);

  /**
   * Every file kind goes through the NDJSON stream: deterministic lanes finish in two progress events,
   * documents stream partial drafts. `progress`/`start` feed the ladder; the machine gets the rest.
   */
  const stream = useCallback(
    async (input: File, handlers: TDraftStreamHandlers) => {
      setProgress(INITIAL_IMPORT_PROGRESS);
      await streamImportConversion(
        buildImportFormData({ workspaceId, file: input, language: languageHint }),
        {
          signal: handlers.signal,
          onEvent: (event: TSurveyImportStreamEvent) => {
            setProgress((current) => reduceImportProgress(current, event));

            if (event.type !== "done") {
              handlers.onEvent(event);
              return;
            }

            referencesRef.current = (event.references as TSurveyExportReferences | null) ?? null;
            if (!event.document) {
              setFatalReport(event.report);
              const firstError = event.report.issues.find((issue) => issue.severity === "error");
              handlers.onEvent({ type: "error", code: firstError?.code ?? "invalid_document" });
              return;
            }

            setFatalReport(null);
            setName(getImportedSurveyName(getDocumentName(event.document)));
            // The final snapshot is the resolved document, not the last model partial: ids, defaults and
            // filled translations only exist after the resolver ran.
            handlers.onEvent({ type: "partial", draft: documentToDraftSnapshot(event.document) });
            handlers.onEvent({
              type: "done",
              payload: event.document as unknown as TV3CreateSurveyBody,
              report: event.report,
            });
          },
        }
      );
    },
    [languageHint, workspaceId]
  );

  const create = useCallback(
    (payload: TV3CreateSurveyBody) =>
      createImportedSurvey({
        workspaceId,
        document: payload as unknown as Record<string, unknown>,
        references: referencesRef.current,
        name: name.trim() || undefined,
      }),
    [name, workspaceId]
  );

  const draft = useDraftCreation<File>({
    stream,
    create,
    // The gate is `checkImportFile` in `selectFile`: a file that passes it is submitted at once.
    canSubmit: true,
    getSourceLabel: (input) => input.name,
    sourceKind: "file",
    onSuccess,
  });

  /** Selecting a valid file is the submit; there is nothing else to fill in first. */
  const selectFile = useCallback(
    (next: File) => {
      const check = checkImportFile(next, isAIAvailable);
      setFile(next);
      setFileCheck(check);
      setFatalReport(null);
      draft.clearError();
      if (check === null) {
        draft.submit(next);
      }
    },
    [draft, isAIAvailable]
  );

  const pickAnotherFile = useCallback(() => {
    draft.handleEditPrompt();
    setFile(null);
    setFileCheck(null);
    setFatalReport(null);
  }, [draft]);

  const report = (draft.report as TImportReport | null) ?? null;

  return {
    file,
    fileCheck,
    selectFile,
    pickAnotherFile,
    name,
    setName,
    status: draft.status,
    draft: draft.draft,
    report,
    fatalReport,
    sourceLabel: draft.sourceLabel,
    errorMessage: draft.errorMessage,
    progress,
    isCreatingSurvey: draft.isCreatingSurvey,
    isNavigatingToEditor: draft.isNavigatingToEditor,
    handleStop: draft.handleStop,
    handleOpenInEditor: draft.handleOpenInEditor,
    handleRegenerate: () => draft.regenerate(),
    canRegenerate: file !== null && report?.source.lane === "ai",
    clearError: draft.clearError,
    hasUnsavedWork: draft.hasUnsavedWork,
  };
};
