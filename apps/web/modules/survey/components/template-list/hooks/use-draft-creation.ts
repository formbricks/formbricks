"use client";

import { useMutation } from "@tanstack/react-query";
import { type SyntheticEvent, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TSurveyGenerationDraftSnapshot } from "@/app/api/internal/surveys/generate/lib/events";
import type { TV3CreateSurveyBody } from "@/app/api/v3/surveys/schemas";
import {
  INITIAL_AI_CREATE_STATE,
  type TAiCreateSourceKind,
  aiCreateReducer,
} from "@/modules/survey/components/template-list/lib/ai-create-machine";
import {
  getAiErrorCode,
  getAiErrorMessage,
} from "@/modules/survey/components/template-list/lib/ai-error-messages";
import { useBeforeUnloadPrompt } from "@/modules/ui/hooks/use-before-unload-prompt";

/** What a draft source streams: the same events the generation stream emits, plus anything extra. */
export type TDraftStreamEvent =
  | { type: "start"; requestId?: string }
  | {
      type: "partial";
      seq?: number;
      draft: TSurveyGenerationDraftSnapshot;
      blockOffset?: number;
      /** Replace the whole draft instead of merging (the resolved document at the end of an import). */
      replace?: boolean;
    }
  | { type: "done"; payload: TV3CreateSurveyBody; report?: unknown }
  | { type: "error"; code: string; detail?: string; reference?: string }
  | { type: string };

export type TDraftStreamHandlers = {
  signal: AbortSignal;
  onEvent: (event: TDraftStreamEvent) => void;
};

export type UseDraftCreationParams<TInput> = {
  /** Run the source: stream events until `done` or `error`. Throws a `V3ApiError` on a pre-stream failure. */
  stream: (input: TInput, handlers: TDraftStreamHandlers) => Promise<void>;
  /** Persist the reviewed payload; returns the created survey id. */
  create: (payload: TV3CreateSurveyBody, report: unknown | null) => Promise<{ id: string }>;
  /** Whether the current input is worth sending at all (prompt length, a file present, AI on). */
  canSubmit: boolean;
  /** Labels the draft on screen: the prompt text, or the file name. */
  getSourceLabel: (input: TInput) => string;
  sourceKind: TAiCreateSourceKind;
  onSuccess: (surveyId: string) => void;
};

/**
 * The source-agnostic half of Create with AI: the `idle → generating → review → creating` machine,
 * the rAF-coalesced snapshot buffer, abort wiring, the unload guard and error-code mapping. The
 * prompt-specific hook and the import hook each pass their own `stream`, `create` and `canSubmit`.
 */
export const useDraftCreation = <TInput>({
  stream,
  create,
  canSubmit,
  getSourceLabel,
  sourceKind,
  onSuccess,
}: UseDraftCreationParams<TInput>) => {
  const { t } = useTranslation();
  const [state, dispatch] = useReducer(aiCreateReducer, INITIAL_AI_CREATE_STATE);
  const [isNavigatingToEditor, setIsNavigatingToEditor] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  /** The input the running generation was started with, so Regenerate can replay it. */
  const lastInputRef = useRef<TInput | null>(null);

  /**
   * Anything a reload would destroy: a generation in flight, the write behind "Open in editor"
   * (which would lose both the survey and the redirect), and a finished draft nobody has opened.
   * The hook re-reads this closure at event time, so plain state is current without a ref.
   */
  const hasUnsavedWork =
    state.status === "generating" || state.status === "creating" || state.payload !== null;

  useBeforeUnloadPrompt(() => hasUnsavedWork);

  // Snapshots land far faster than the screen can usefully change, so buffer the newest one and
  // dispatch at most once per frame.
  const pendingSnapshotRef = useRef<{
    snapshot: TSurveyGenerationDraftSnapshot;
    blockOffset: number;
    replace: boolean;
  } | null>(null);
  const frameRef = useRef<number | null>(null);

  /**
   * Drop anything the previous generation had queued. A snapshot buffered for the next frame can
   * otherwise land after Stop and Regenerate have already started a new run, and the append-only
   * reducer would happily merge the abandoned questions into the new draft.
   */
  const discardQueuedSnapshot = useCallback(() => {
    pendingSnapshotRef.current = null;
    if (frameRef.current !== null) {
      globalThis.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const flushSnapshot = useCallback(() => {
    frameRef.current = null;
    const pending = pendingSnapshotRef.current;
    pendingSnapshotRef.current = null;

    if (pending) {
      dispatch({
        type: "SNAPSHOT",
        snapshot: pending.snapshot,
        blockOffset: pending.blockOffset,
        replace: pending.replace,
      });
    }
  }, []);

  const queueSnapshot = useCallback(
    (snapshot: TSurveyGenerationDraftSnapshot, blockOffset = 0, replace = false) => {
      pendingSnapshotRef.current = { snapshot, blockOffset, replace };
      frameRef.current ??= globalThis.requestAnimationFrame(flushSnapshot);
    },
    [flushSnapshot]
  );

  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
      if (frameRef.current !== null) {
        globalThis.cancelAnimationFrame(frameRef.current);
      }
    },
    []
  );

  const createSurveyMutation = useMutation({
    mutationFn: ({ payload, report }: { payload: TV3CreateSurveyBody; report: unknown | null }) =>
      create(payload, report),
    onSuccess: (survey) => {
      setIsNavigatingToEditor(true);
      onSuccess(survey.id);
    },
    onError: (error) => {
      dispatch({ type: "CREATE_FAILED", errorCode: getAiErrorCode(error) });
    },
  });

  const runGeneration = useCallback(
    async (input: TInput) => {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      lastInputRef.current = input;

      try {
        await stream(input, {
          signal: controller.signal,
          onEvent: (event) => {
            // Nothing from a run the user already abandoned reaches the reducer — terminal events
            // included, since a late `done` would hand the restored draft the wrong payload.
            if (abortControllerRef.current !== controller) return;

            switch (event.type) {
              case "partial": {
                const partial = event as Extract<TDraftStreamEvent, { type: "partial" }>;
                queueSnapshot(partial.draft, partial.blockOffset ?? 0, partial.replace ?? false);
                break;
              }
              case "done": {
                const done = event as Extract<TDraftStreamEvent, { type: "done" }>;
                flushSnapshot();
                dispatch({ type: "DONE", payload: done.payload, report: done.report ?? null });
                break;
              }
              case "error": {
                const failure = event as Extract<TDraftStreamEvent, { type: "error" }>;
                dispatch({ type: "FAIL", errorCode: failure.code, errorReference: failure.reference });
                break;
              }
              default:
                break;
            }
          },
        });
      } catch (error) {
        // Stop aborts the fetch; that is the user getting what they asked for, not a failure.
        if (controller.signal.aborted) return;

        dispatch({ type: "FAIL", errorCode: getAiErrorCode(error) });
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
    [flushSnapshot, queueSnapshot, stream]
  );

  const canCreate = canSubmit && state.status === "idle";

  /** Start a fresh run from `input`. Accepts the form's submit event so it can be the `onSubmit`. */
  const submit = useCallback(
    (input: TInput, event?: SyntheticEvent) => {
      event?.preventDefault();
      if (!canCreate) return;

      dispatch({ type: "SUBMIT", prompt: getSourceLabel(input), sourceKind });
      void runGeneration(input);
    },
    [canCreate, getSourceLabel, runGeneration, sourceKind]
  );

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
    discardQueuedSnapshot();
    dispatch({ type: "STOP" });
  }, [discardQueuedSnapshot]);

  /** Re-run the source. Defaults to the input of the last run; pass one to regenerate from new input. */
  const regenerate = useCallback(
    (input?: TInput) => {
      const next = input ?? lastInputRef.current;
      // Regenerate is reachable with an input the form would never have let you submit: edit the
      // prompt, clear it, go back to the kept draft, press Regenerate. Same gate as the first run.
      if (!canSubmit || next === null || next === undefined) return;

      discardQueuedSnapshot();
      dispatch({ type: "REGENERATE", prompt: getSourceLabel(next), sourceKind });
      void runGeneration(next);
    },
    [canSubmit, discardQueuedSnapshot, getSourceLabel, runGeneration, sourceKind]
  );

  const handleEditPrompt = useCallback(() => {
    abortControllerRef.current?.abort();
    discardQueuedSnapshot();
    dispatch({ type: "EDIT_PROMPT" });
  }, [discardQueuedSnapshot]);

  const handleOpenInEditor = useCallback(() => {
    if (state.status !== "review" || !state.payload) return;

    dispatch({ type: "CREATE" });
    createSurveyMutation.mutate({ payload: state.payload, report: state.report });
  }, [createSurveyMutation, state.payload, state.report, state.status]);

  const handleBackToDraft = useCallback(() => dispatch({ type: "BACK_TO_DRAFT" }), []);

  const clearError = useCallback(() => dispatch({ type: "CLEAR_ERROR" }), []);

  const errorMessage = useMemo(
    () => (state.errorCode === null ? null : getAiErrorMessage(state.errorCode, t)),
    [state.errorCode, t]
  );

  return {
    state,
    status: state.status,
    draft: state.draft,
    payload: state.payload,
    report: state.report,
    /** The label of the source the draft on screen came from (prompt text or file name). */
    sourceLabel: state.sourceLabel,
    canCreate,
    errorMessage,
    errorCode: state.errorCode,
    errorReference: state.errorReference,
    isNavigatingToEditor,
    isCreatingSurvey: state.status === "creating" || isNavigatingToEditor,
    submit,
    regenerate,
    handleStop,
    handleEditPrompt,
    handleBackToDraft,
    handleOpenInEditor,
    clearError,
    /** A finished draft the user stepped away from, and can still return to. */
    hasKeptDraft: state.payload !== null && state.status === "idle",
    /** Closing or reloading now would throw away work: a generation, a write, or a kept draft. */
    hasUnsavedWork,
  };
};
