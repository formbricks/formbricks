"use client";

import { useCallback, useRef, useState } from "react";
import { getAIUnavailableReasonForErrorCode } from "@/lib/ai/availability";
import { type TV3InvalidParam, V3ApiError } from "@/modules/api/lib/v3-client";
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
import {
  createSurveyFromImport,
  updateSurveyFromImport,
} from "@/modules/survey/import/lib/survey-imports-client";
import type {
  TSurveyImportMatch,
  TSurveyImportReport,
  TSurveyImportStage,
  TSurveyImportTriggersChoice,
} from "@/modules/survey/import/types";
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

/** On a Match (ENG-6851): replace the matched survey's content, or save the file as a new survey. */
export type TSurveyImportChoice = "update" | "create";

/**
 * Why the Update a Match offered is no longer the plain one: the survey changed after the file was
 * exported (`stale`, the dialog offers "Update anyway"), or it is live (`active`, Create new only).
 */
export type TSurveyImportMatchConflict = "stale" | "active";

/**
 * The dialog's code for a first 409 on Update: the dialog shows the "changed since you exported" choice
 * for it, not an error. A 409 on "Update anyway" means the survey changed again after the review.
 */
export const SURVEY_CHANGED_CODE = "survey_changed";
const SURVEY_CHANGED_AGAIN_CODE = "survey_changed_again";

/** A refusal with the dialog's own code, keeping everything else the server said. */
const withCode = (error: V3ApiError, code: string): V3ApiError =>
  new V3ApiError({
    status: error.status,
    detail: error.message,
    code,
    requestId: error.requestId,
    invalid_params: error.invalid_params,
    details: error.details,
  });

/** The choice a Match opens with: Update, unless the survey is live. */
const initialChoice = (match: TSurveyImportMatch | null): TSurveyImportChoice =>
  match && match.status !== "inProgress" ? "update" : "create";

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
  /** The survey the file was exported from, when the user may update it (ENG-6851). */
  const [match, setMatch] = useState<TSurveyImportMatch | null>(null);
  const [choice, setChoice] = useState<TSurveyImportChoice>("create");
  const [triggersChoice, setTriggersChoice] = useState<TSurveyImportTriggersChoice>("file");
  const [conflict, setConflict] = useState<TSurveyImportMatchConflict | null>(null);

  /** A new review, or none: what a Match offered goes with the review it came with. */
  const resetMatch = useCallback((next: TSurveyImportMatch | null) => {
    setMatch(next);
    setChoice(initialChoice(next));
    setTriggersChoice(next?.triggers === "keep_only" ? "keep" : "file");
    setConflict(next?.status === "inProgress" ? "active" : null);
  }, []);

  const stream = useCallback(
    async (
      input: TSurveyImportInput,
      handlers: TDraftStreamHandlers<TSurveyImportReport, TSurveyImportPayload>
    ) => {
      setStage(null);
      setRetryAfterSeconds(null);
      setInvalidParams(null);
      commitRef.current = null;
      resetMatch(null);

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
                  resetMatch(event.match ?? null);
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
    [workspaceId, resetMatch]
  );

  /**
   * Update the matched survey (ENG-6851). First against the file's export time; once the server said
   * the survey changed since, "Update anyway" goes against the time the review read it, so a survey that
   * changed again — or went live — after the review is still refused. Either refusal moves the choice to
   * Create new.
   */
  const updateMatch = useCallback(
    async (
      matched: TSurveyImportMatch,
      body: Omit<Parameters<typeof updateSurveyFromImport>[1], "updatedAt" | "triggers">
    ): Promise<{ id: string }> => {
      const isUpdateAnyway = conflict === "stale";
      try {
        await updateSurveyFromImport(matched.surveyId, {
          ...body,
          updatedAt: isUpdateAnyway ? matched.updatedAt : matched.exportedUpdatedAt,
          triggers: matched.triggers === "keep_only" ? "keep" : triggersChoice,
        });
        return { id: matched.surveyId };
      } catch (error) {
        if (!(error instanceof V3ApiError)) throw error;
        if (error.status === 409) {
          setChoice("create");
          if (isUpdateAnyway) throw withCode(error, SURVEY_CHANGED_AGAIN_CODE);
          setConflict("stale");
          throw withCode(error, SURVEY_CHANGED_CODE);
        }
        if (error.code === "survey_active") {
          setChoice("create");
          setConflict("active");
        }
        throw error;
      }
    },
    [conflict, triggersChoice]
  );

  const create = useCallback(
    (payload: TSurveyImportPayload) => {
      const commit = commitRef.current;
      if (!commit) return createV3Survey(payload, "import");
      const { workspaceId: _workspaceId, ...survey } = payload;
      if (match && choice === "update") {
        return updateMatch(match, { survey, references: commit.references });
      }
      return createSurveyFromImport(
        { workspaceId, survey, references: commit.references },
        commit.idempotencyKey
      );
    },
    [workspaceId, match, choice, updateMatch]
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
    resetMatch(null);
  };

  // The first 409 on Update is not an error to show: the dialog offers its choice instead.
  const errorCode =
    fileError ?? (draft.state.errorCode === SURVEY_CHANGED_CODE ? null : draft.state.errorCode);

  /** The choice changes what the commit does, so a message about the last attempt no longer applies. */
  const selectChoice = (next: TSurveyImportChoice) => {
    draft.clearError();
    setChoice(next);
  };

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
    /** The survey the file was exported from, when the user may update it; `null` when there is none. */
    match,
    /** What Create new names the survey: the reviewed draft's "<name> (imported)". */
    newSurveyName: draft.payload?.name ?? "",
    /** On a Match: Update or Create new. `create` when there is no Match. */
    choice,
    selectChoice,
    /** On an Update whose triggers differ: the file's or the survey's own. */
    triggersChoice,
    selectTriggersChoice: setTriggersChoice,
    /** Why the plain Update is off the table: the survey changed since the export, or is live. */
    conflict,
  };
};
