"use client";

import { useMutation } from "@tanstack/react-query";
import { useCallback, useState } from "react";
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

type TSurveyImportInput = { file: File };

const getFileLabel = (input: TSurveyImportInput) => input.file.name;

type UseImportSurveyProps = {
  workspaceId: string;
  isAIAvailable: boolean;
  onSuccess: (surveyId: string) => void;
};

/**
 * What a finished import returned besides its draft, kept with the draft in the draft machine so a new
 * review replaces all of it at once: the report, the references a Formbricks file carries back to the
 * create, the Match it found, and the review's own `Idempotency-Key`, so creating it twice makes one
 * survey.
 */
type TSurveyImportReview = {
  report: TSurveyImportReport;
  references?: TFormbricksFileReferences;
  match: TSurveyImportMatch | null;
  idempotencyKey: string;
};

/** On a Match (ENG-6851): replace the matched survey's content, or save the file as a new survey. */
export type TSurveyImportChoice = "update" | "create";

/**
 * Why the Update a Match offered is no longer the plain one: the survey changed after the file was
 * exported (`stale`, the dialog offers "Update anyway"), it is live (`active`, Create new only), or the
 * file cannot update it (`refused`, Create new only, with the review's reasons).
 */
export type TSurveyImportMatchConflict = "stale" | "active" | "refused";

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

/** What rules the Update out from the review on: the survey is live, or the file cannot update it. */
const getMatchConflict = (match: TSurveyImportMatch): TSurveyImportMatchConflict | null => {
  if (match.status === "inProgress") return "active";
  if (match.updateRefusal.length > 0) return "refused";
  return null;
};

/** The refusals whose `invalid_params` name the file's fields, which the dialog lists. */
const FIELD_REFUSAL_CODES = new Set(["formbricks_file_invalid", "formbricks_file_too_new"]);

type TUpdateVariables = {
  match: TSurveyImportMatch;
  survey: Record<string, unknown>;
  references: TFormbricksFileReferences;
  triggers: TSurveyImportTriggersChoice;
  /** "Update anyway": made against the time the review read, after the server said the survey changed. */
  isUpdateAnyway: boolean;
};

type TCreateVariables = {
  survey: Record<string, unknown>;
  references?: TFormbricksFileReferences;
  idempotencyKey: string;
};

/**
 * Import survey: a file in, a reviewed draft out, on the machine Create with AI uses. This hook adds
 * what is the file's own: the check on its name and size, the upload, the import route's progress
 * stages, and its pre-stream refusals, which it turns into `error` events so they reach the same error
 * state. The file is uploaded as it is; the server reads it and says what is wrong with its content.
 *
 * What the server returned lives where it came from: the review (draft, report, references, Match) in
 * the draft machine, and the outcome of an Update or a create in its TanStack mutation, which is what
 * the Match's conflict is read from. Only the user's own choices are state here.
 *
 * A Formbricks file needs no AI (ENG-6850): it imports without it. Every draft is created through
 * `POST /api/internal/surveys/imports`, a Formbricks file's with the references it carries.
 */
export const useImportSurvey = ({ workspaceId, isAIAvailable, onSuccess }: UseImportSurveyProps) => {
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [fileError, setFileError] = useState<TSurveyImportFileError | null>(null);
  /** What a refusal of the upload said about each field of the file, for a file the dialog can say that of. */
  const [invalidParams, setInvalidParams] = useState<TV3InvalidParam[] | null>(null);
  /** The stream's latest progress stage, and the `Retry-After` its last refusal carried. */
  const [stage, setStage] = useState<TSurveyImportStage | null>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | null>(null);
  /** On a Match, what the user picked; `null` until they pick, which means the review's default. */
  const [selectedChoice, setSelectedChoice] = useState<TSurveyImportChoice | null>(null);
  const [selectedTriggers, setSelectedTriggers] = useState<TSurveyImportTriggersChoice | null>(null);

  /**
   * Update the matched survey (ENG-6851). First against the file's export time; once the server said
   * the survey changed since, "Update anyway" goes against the time the review read it, so a survey
   * that changed again — or went live — after the review is still refused. Either refusal moves the
   * choice to Create new.
   */
  const updateMutation = useMutation({
    mutationFn: async ({ match, survey, references, triggers, isUpdateAnyway }: TUpdateVariables) => {
      try {
        await updateSurveyFromImport(match.surveyId, {
          survey,
          references,
          updatedAt: isUpdateAnyway ? match.updatedAt : match.exportedUpdatedAt,
          triggers,
        });
        return { id: match.surveyId };
      } catch (error) {
        if (error instanceof V3ApiError && error.status === 409) {
          throw withCode(error, isUpdateAnyway ? SURVEY_CHANGED_AGAIN_CODE : SURVEY_CHANGED_CODE);
        }
        throw error;
      }
    },
    onError: (error) => {
      if (error instanceof V3ApiError && (error.status === 409 || error.code === "survey_active")) {
        setSelectedChoice("create");
      }
    },
  });

  const createMutation = useMutation({
    mutationFn: ({ survey, references, idempotencyKey }: TCreateVariables) =>
      createSurveyFromImport({ workspaceId, survey, ...(references ? { references } : {}) }, idempotencyKey),
  });

  const { reset: resetUpdate } = updateMutation;
  const { reset: resetCreate } = createMutation;
  /** A new review, or none: the outcome of the last one's Update and the user's choices go with it. */
  const forgetReview = useCallback(() => {
    setSelectedChoice(null);
    setSelectedTriggers(null);
    resetUpdate();
    resetCreate();
  }, [resetUpdate, resetCreate]);

  const stream = useCallback(
    async (
      input: TSurveyImportInput,
      handlers: TDraftStreamHandlers<TSurveyImportReview, TSurveyImportPayload>
    ) => {
      setStage(null);
      setRetryAfterSeconds(null);
      setInvalidParams(null);
      forgetReview();

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
                  // No partials on this stream: the review list is drawn once, from the finished payload.
                  handlers.onEvent({ type: "partial", draft: payloadToDraftSnapshot(event.payload) });
                  handlers.onEvent({
                    type: "done",
                    payload: event.payload,
                    report: {
                      report: event.report,
                      ...(event.references ? { references: event.references } : {}),
                      match: event.match ?? null,
                      // One key per review: a new file, or the same file again, is a new review.
                      idempotencyKey: crypto.randomUUID(),
                    },
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
    [workspaceId, forgetReview]
  );

  const draft = useDraftCreation<TSurveyImportInput, TSurveyImportReview, TSurveyImportPayload>({
    stream,
    // Called on "Open in editor", by then with this render's review and choices (`commit` below).
    create: (payload) => commit(payload),
    // The file itself is checked in `selectFile`, against what this organization can import; a file
    // that passes is submitted at once. A Formbricks file needs no AI, so the dialog always takes one.
    canSubmit: true,
    getSourceLabel: getFileLabel,
    sourceKind: "file",
    onSuccess,
  });

  const match = draft.report?.match ?? null;

  /** What rules out the plain Update: the review's own reason, else what the last Update attempt said. */
  const getConflict = (): TSurveyImportMatchConflict | null => {
    if (!match) return null;
    const fromReview = getMatchConflict(match);
    if (fromReview) return fromReview;
    const { error, variables } = updateMutation;
    if (error instanceof V3ApiError && error.code === "survey_active") return "active";
    // Once the server said the survey changed, every later attempt in this review is "Update anyway".
    if (error instanceof V3ApiError && error.status === 409) return "stale";
    return variables?.isUpdateAnyway ? "stale" : null;
  };
  const conflict = getConflict();
  const isUpdateLocked = conflict === "active" || conflict === "refused";
  const choice: TSurveyImportChoice = match && !isUpdateLocked ? (selectedChoice ?? "update") : "create";
  const triggersChoice: TSurveyImportTriggersChoice =
    match?.triggers === "keep_only" ? "keep" : (selectedTriggers ?? "file");

  /** Save the reviewed draft: an Update of the matched survey, or a new survey. */
  const commit = (payload: TSurveyImportPayload): Promise<{ id: string }> => {
    const current = draft.report;
    // The review comes with its draft, and the create is reachable only from a review.
    if (!current) return Promise.reject(new Error("No review to create the survey from"));
    const { workspaceId: _workspaceId, ...survey } = payload;
    if (current.match && choice === "update" && current.references) {
      return updateMutation.mutateAsync({
        match: current.match,
        survey,
        references: current.references,
        triggers: triggersChoice,
        isUpdateAnyway: conflict === "stale",
      });
    }
    return createMutation.mutateAsync({
      survey,
      ...(current.references ? { references: current.references } : {}),
      idempotencyKey: current.idempotencyKey,
    });
  };

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
    forgetReview();
  };

  // The first 409 on Update is not an error to show: the dialog offers its choice instead.
  const errorCode =
    fileError ?? (draft.state.errorCode === SURVEY_CHANGED_CODE ? null : draft.state.errorCode);

  /** The choice changes what the commit does, so a message about the last attempt no longer applies. */
  const selectChoice = (next: TSurveyImportChoice) => {
    draft.clearError();
    setSelectedChoice(next);
  };

  return {
    file,
    selectFile,
    pickAnotherFile,
    stage,
    status: draft.status,
    draft: draft.draft,
    report: draft.report?.report ?? null,
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
    selectTriggersChoice: setSelectedTriggers,
    /** Why the plain Update is off the table: the survey changed since the export, is live, or refused. */
    conflict,
  };
};
