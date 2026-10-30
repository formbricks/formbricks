"use client";

import { useCallback, useRef, useState } from "react";
import { getAIUnavailableReasonForErrorCode } from "@/lib/ai/availability";
import type { TV3InvalidParam } from "@/modules/api/lib/v3-client";
import {
  type TDraftStreamHandlers,
  useDraftCreation,
} from "@/modules/survey/components/template-list/hooks/use-draft-creation";
import type { TFormbricksFileReferences } from "@/modules/survey/formbricks-file/envelope";
import type { TSurveyImportPayload } from "@/modules/survey/import/core/draft";
import { getSurveyImportRequestErrorCode } from "@/modules/survey/import/lib/import-errors";
import { type TSurveyImportFileError, checkSurveyImportFile } from "@/modules/survey/import/lib/import-file";
import {
  SurveyImportRequestError,
  streamSurveyImportFile,
} from "@/modules/survey/import/lib/import-stream-client";
import { payloadToDraftSnapshot } from "@/modules/survey/import/lib/payload-to-draft";
import { createSurveyFromImport } from "@/modules/survey/import/lib/survey-imports-client";
import type { TSurveyImportReport, TSurveyImportStage } from "@/modules/survey/import/types";
import { createV3Survey } from "@/modules/survey/list/lib/v3-surveys-client";

type TSurveyImportInput = { file: File };

const getFileLabel = (input: TSurveyImportInput) => input.file.name;

type UseImportSurveyProps = {
  workspaceId: string;
  isAIAvailable: boolean;
  onSuccess: (surveyId: string) => void;
};

/**
 * How a reviewed draft is created when its file carried references (a Formbricks file): sent back with
 * them, under the review's own `Idempotency-Key`, so creating it twice makes one survey.
 */
type TImportCommit = { references: TFormbricksFileReferences; idempotencyKey: string };

/** The refusals whose `invalid_params` name the file's fields, which the dialog lists. */
const FIELD_REFUSAL_CODES = new Set(["formbricks_file_invalid", "formbricks_file_too_new"]);

/**
 * Import survey: a file in, a reviewed draft out, on the machine Create with AI uses. This hook adds
 * what is the file's own: the check on its name and size, the upload, the import route's progress
 * stages, and its pre-stream refusals, which it turns into `error` events so they reach the same error
 * state. The file is uploaded as it is; the server reads it and says what is wrong with its content.
 *
 * A Formbricks file needs no AI (ENG-6850): it imports without it, and its draft is created with the
 * references it carries through `POST /api/internal/surveys/imports` rather than the v3 create.
 */
export const useImportSurvey = ({ workspaceId, isAIAvailable, onSuccess }: UseImportSurveyProps) => {
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [fileError, setFileError] = useState<TSurveyImportFileError | null>(null);
  /** What a refusal said about each field of the file, for a file the dialog can say that of. */
  const [invalidParams, setInvalidParams] = useState<TV3InvalidParam[] | null>(null);
  // Read when the create runs, not when it was defined: the review it creates is the latest one.
  const commitRef = useRef<TImportCommit | null>(null);
  const [stage, setStage] = useState<TSurveyImportStage | null>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | null>(null);

  const stream = useCallback(
    async (
      input: TSurveyImportInput,
      handlers: TDraftStreamHandlers<TSurveyImportReport, TSurveyImportPayload>
    ) => {
      setStage(null);
      setRetryAfterSeconds(null);
      setInvalidParams(null);
      commitRef.current = null;

      try {
        await streamSurveyImportFile(
          { workspaceId, file: input.file },
          {
            signal: handlers.signal,
            onEvent: (event) => {
              switch (event.type) {
                case "progress":
                  // A repeat of the current stage is a heartbeat, and setting the same value is a no-op.
                  setStage(event.stage);
                  break;
                case "done":
                  // One key per review: a new file, or the same file again, is a new review.
                  commitRef.current = event.references
                    ? { references: event.references, idempotencyKey: crypto.randomUUID() }
                    : null;
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
        if (!(error instanceof SurveyImportRequestError)) throw error;

        setRetryAfterSeconds(error.retryAfterSeconds);
        const code = getSurveyImportRequestErrorCode(error);
        if (FIELD_REFUSAL_CODES.has(code)) setInvalidParams(error.invalid_params ?? null);
        handlers.onEvent({ type: "error", code });
      }
    },
    [workspaceId]
  );

  const create = useCallback(
    (payload: TSurveyImportPayload) => {
      const commit = commitRef.current;
      if (!commit) return createV3Survey(payload, "import");
      const { workspaceId: _workspaceId, ...survey } = payload;
      return createSurveyFromImport(
        { workspaceId, survey, references: commit.references },
        commit.idempotencyKey
      );
    },
    [workspaceId]
  );

  const draft = useDraftCreation<TSurveyImportInput, TSurveyImportReport, TSurveyImportPayload>({
    stream,
    create,
    // The file itself is checked in `selectFile`, against what this organization can import; a file
    // that passes is submitted at once. A Formbricks file needs no AI, so the dialog always takes one.
    canSubmit: true,
    getSourceLabel: getFileLabel,
    sourceKind: "file",
    onSuccess,
  });

  /** Choosing a file is the submit: it is checked by name and size here, then uploaded if it passes. */
  const selectFile = (next: File) => {
    draft.clearError();
    setFileError(null);
    setInvalidParams(null);
    setFile({ name: next.name, size: next.size });

    const refused = checkSurveyImportFile(next, { isAIAvailable });
    if (refused) {
      setFileError(refused);
      return;
    }

    draft.submit({ file: next });
  };

  const pickAnotherFile = () => {
    draft.reset();
    setFile(null);
    setFileError(null);
    setInvalidParams(null);
    setStage(null);
    commitRef.current = null;
  };

  const errorCode = fileError ?? draft.state.errorCode;

  return {
    file,
    selectFile,
    pickAnotherFile,
    stage,
    status: draft.status,
    draft: draft.draft,
    report: draft.report,
    errorCode,
    /** The fields a refused Formbricks file got wrong, from the server's `invalid_params`. */
    invalidParams: errorCode ? invalidParams : null,
    retryAfterSeconds,
    /** Set when the route said AI is off after the page loaded, so the dialog shows the shared alert. */
    aiUnavailableReason: getAIUnavailableReasonForErrorCode(draft.state.errorCode ?? undefined),
    isCreatingSurvey: draft.isCreatingSurvey,
    handleStop: draft.handleStop,
    handleOpenInEditor: draft.handleOpenInEditor,
    clearError: () => {
      setFileError(null);
      setInvalidParams(null);
      draft.clearError();
    },
    hasUnsavedWork: draft.hasUnsavedWork,
  };
};
