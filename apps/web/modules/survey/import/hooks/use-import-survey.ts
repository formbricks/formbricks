"use client";

import { useCallback, useState } from "react";
import { getAIUnavailableReasonForErrorCode } from "@/lib/ai/availability";
import {
  type TDraftStreamHandlers,
  useDraftCreation,
} from "@/modules/survey/components/template-list/hooks/use-draft-creation";
import { getQsfImportRequestErrorCode } from "@/modules/survey/import/lib/import-errors";
import { QsfImportRequestError, streamQsfImport } from "@/modules/survey/import/lib/import-stream-client";
import { payloadToDraftSnapshot } from "@/modules/survey/import/lib/payload-to-draft";
import { type TQsfFileError, readQsfFile } from "@/modules/survey/import/lib/qsf-file";
import type { TQsfDraftDocument } from "@/modules/survey/import/qsf/draft";
import type { TQsfImportReport, TQsfImportStage } from "@/modules/survey/import/types";
import { createV3Survey } from "@/modules/survey/list/lib/v3-surveys-client";

type TQsfImportInput = { fileName: string; qsf: Record<string, unknown> };

const getFileLabel = (input: TQsfImportInput) => input.fileName;

type UseImportSurveyProps = {
  workspaceId: string;
  isAIAvailable: boolean;
  onSuccess: (surveyId: string) => void;
};

/**
 * Import survey: a .qsf in, a reviewed draft out, on the machine Create with AI uses. This hook adds
 * what is the file's own: reading it in the browser, the import route's progress stages, and its
 * pre-stream refusals, which it turns into `error` events so they reach the same error state.
 */
export const useImportSurvey = ({ workspaceId, isAIAvailable, onSuccess }: UseImportSurveyProps) => {
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [fileError, setFileError] = useState<TQsfFileError | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [stage, setStage] = useState<TQsfImportStage | null>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | null>(null);

  const stream = useCallback(
    async (input: TQsfImportInput, handlers: TDraftStreamHandlers<TQsfImportReport, TQsfDraftDocument>) => {
      setStage(null);
      setRetryAfterSeconds(null);

      try {
        await streamQsfImport(
          { workspaceId, fileName: input.fileName, qsf: input.qsf },
          {
            signal: handlers.signal,
            onEvent: (event) => {
              switch (event.type) {
                case "progress":
                  // A repeat of the current stage is a heartbeat, and setting the same value is a no-op.
                  setStage(event.stage);
                  break;
                case "done":
                  // No partials on this stream: the review list is drawn once, from the finished payload.
                  handlers.onEvent({ type: "partial", draft: payloadToDraftSnapshot(event.payload) });
                  handlers.onEvent({
                    type: "done",
                    payload: event.payload,
                    report: event.report,
                  });
                  break;
                case "error":
                  setRetryAfterSeconds(event.retryAfter ?? null);
                  handlers.onEvent(event);
                  break;
                default:
                  handlers.onEvent(event);
              }
            },
          }
        );
      } catch (error) {
        // Stop aborts the fetch, and the shared hook already ignores that; only refusals map here.
        if (!(error instanceof QsfImportRequestError)) throw error;

        setRetryAfterSeconds(error.retryAfterSeconds);
        handlers.onEvent({ type: "error", code: getQsfImportRequestErrorCode(error) });
      }
    },
    [workspaceId]
  );

  const create = useCallback((payload: TQsfDraftDocument) => createV3Survey(payload, "import"), []);

  const draft = useDraftCreation<TQsfImportInput, TQsfImportReport, TQsfDraftDocument>({
    stream,
    create,
    // The file itself is checked in `selectFile`; a file that passes is submitted at once.
    canSubmit: isAIAvailable,
    getSourceLabel: getFileLabel,
    sourceKind: "file",
    onSuccess,
  });

  /** Choosing a file is the submit: it is read and checked here, then sent if it passes. */
  const selectFile = async (next: File) => {
    draft.clearError();
    setFileError(null);
    setFile({ name: next.name, size: next.size });
    setIsReadingFile(true);

    const result = await readQsfFile(next);
    setIsReadingFile(false);

    if (!result.ok) {
      setFileError(result.error);
      return;
    }

    draft.submit({ fileName: result.fileName, qsf: result.qsf });
  };

  const pickAnotherFile = () => {
    draft.reset();
    setFile(null);
    setFileError(null);
    setStage(null);
  };

  const errorCode = fileError ?? draft.state.errorCode;

  return {
    file,
    isReadingFile,
    selectFile,
    pickAnotherFile,
    stage,
    status: draft.status,
    draft: draft.draft,
    report: draft.report,
    errorCode,
    retryAfterSeconds,
    /** Set when the route said AI is off after the page loaded, so the dialog shows the shared alert. */
    aiUnavailableReason: getAIUnavailableReasonForErrorCode(draft.state.errorCode ?? undefined),
    isCreatingSurvey: draft.isCreatingSurvey,
    handleStop: draft.handleStop,
    handleOpenInEditor: draft.handleOpenInEditor,
    clearError: () => {
      setFileError(null);
      draft.clearError();
    },
    hasUnsavedWork: draft.hasUnsavedWork,
  };
};
