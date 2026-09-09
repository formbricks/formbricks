"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TSurveyExportReferences } from "@/app/api/v3/surveys/export/schemas";
import type { TV3CreateSurveyBody } from "@/app/api/v3/surveys/schemas";
import {
  type TDraftStreamHandlers,
  useDraftCreation,
} from "@/modules/survey/components/template-list/hooks/use-draft-creation";
import { detectJsonSourceKind } from "@/modules/survey/import/detect-json";
import { getImportLaneForFileName } from "@/modules/survey/import/file-types";
import { documentToDraftSnapshot } from "@/modules/survey/import/lib/draft-snapshot";
import {
  type TImportConvertResult,
  convertImportFile,
  createImportedSurvey,
  importSurveyDryRun,
  readImportFileAsJson,
} from "@/modules/survey/import/lib/import-client";
import { type TImportFileCheckCode, checkImportFile } from "@/modules/survey/import/lib/import-file-checks";
import { getDocumentName, getImportedSurveyName } from "@/modules/survey/import/lib/imported-survey-name";
import type { TImportReport } from "@/modules/survey/import/types";

type UseImportSurveyProps = {
  workspaceId: string;
  isAIAvailable: boolean;
  onSuccess: (surveyId: string) => void;
};

async function resolveFile(
  file: File,
  workspaceId: string,
  signal: AbortSignal
): Promise<TImportConvertResult> {
  const lane = getImportLaneForFileName(file.name);

  // JSON goes straight to the import route's dry run; a `.json` that turns out to be a QSF, and every
  // other file, goes through the multipart convert endpoint.
  if (lane === "lossless") {
    const parsed = await readImportFileAsJson(file);
    const kind = detectJsonSourceKind(parsed);
    if (parsed !== null && kind !== null && kind !== "qsf") {
      return importSurveyDryRun({
        workspaceId,
        source:
          kind === "formbricks-export"
            ? { export: parsed as Record<string, unknown> }
            : { document: parsed as Record<string, unknown> },
        signal,
      });
    }
  }

  return convertImportFile({ workspaceId, file, signal });
}

/**
 * Import survey: a file in, a reviewed draft out. Built on the same machine Create with AI uses; this
 * hook supplies the file state, the resolve call (dry run or convert) and the create call through the
 * import route.
 */
export const useImportSurvey = ({ workspaceId, isAIAvailable, onSuccess }: UseImportSurveyProps) => {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [fileCheck, setFileCheck] = useState<TImportFileCheckCode | null>(null);
  const [name, setName] = useState("");
  /** The report of a run that produced no document: shown under the error so the reasons are visible. */
  const [fatalReport, setFatalReport] = useState<TImportReport | null>(null);
  const referencesRef = useRef<TSurveyExportReferences | null>(null);

  const stream = useCallback(
    async (input: File, handlers: TDraftStreamHandlers) => {
      handlers.onEvent({ type: "start" });
      const result = await resolveFile(input, workspaceId, handlers.signal);
      referencesRef.current = result.references;

      if (!result.document) {
        setFatalReport(result.report);
        const firstError = result.report.issues.find((issue) => issue.severity === "error");
        handlers.onEvent({ type: "error", code: firstError?.code ?? "invalid_document" });
        return;
      }

      setFatalReport(null);
      setName(getImportedSurveyName(getDocumentName(result.document)));
      handlers.onEvent({ type: "partial", draft: documentToDraftSnapshot(result.document) });
      handlers.onEvent({
        type: "done",
        payload: result.document as unknown as TV3CreateSurveyBody,
        report: result.report,
      });
    },
    [workspaceId]
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

  const convertingMessages = useMemo(
    () => [t("workspace.surveys.import.status_reading"), t("workspace.surveys.import.status_validating")],
    [t]
  );

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
    convertingMessages,
    isCreatingSurvey: draft.isCreatingSurvey,
    isNavigatingToEditor: draft.isNavigatingToEditor,
    handleStop: draft.handleStop,
    handleOpenInEditor: draft.handleOpenInEditor,
    handleRegenerate: () => draft.regenerate(),
    clearError: draft.clearError,
    hasUnsavedWork: draft.hasUnsavedWork,
  };
};
