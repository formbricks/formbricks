"use client";

import { useMutation } from "@tanstack/react-query";
import { type SyntheticEvent, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TUserLocale } from "@formbricks/types/user";
import type { TSurveyGenerationDraftSnapshot } from "@/app/api/internal/surveys/generate/lib/events";
import type { TV3CreateSurveyBody } from "@/app/api/v3/surveys/schemas";
import {
  INITIAL_AI_CREATE_STATE,
  aiCreateReducer,
} from "@/modules/survey/components/template-list/lib/ai-create-machine";
import { AI_SURVEY_PROMPT_MIN_LENGTH } from "@/modules/survey/components/template-list/lib/ai-create-utils";
import {
  getAiErrorCode,
  getAiErrorMessage,
} from "@/modules/survey/components/template-list/lib/ai-error-messages";
import { streamSurveyGeneration } from "@/modules/survey/components/template-list/lib/ai-generate-stream-client";
import { createV3Survey } from "@/modules/survey/list/lib/v3-surveys-client";
import { useBeforeUnloadPrompt } from "@/modules/ui/hooks/use-before-unload-prompt";

type UseCreateSurveyWithAIProps = {
  workspaceId: string;
  language: TUserLocale;
  isAIAvailable: boolean;
  onSuccess: (surveyId: string) => void;
};

export const useCreateSurveyWithAI = ({
  workspaceId,
  language,
  isAIAvailable,
  onSuccess,
}: UseCreateSurveyWithAIProps) => {
  const { t } = useTranslation();
  // Deliberately outside the reducer: the prompt is never touched by a transition, so it survives a
  // failed generation without a restore path that could get it wrong.
  const [prompt, setPrompt] = useState("");
  const [state, dispatch] = useReducer(aiCreateReducer, INITIAL_AI_CREATE_STATE);
  const [isNavigatingToEditor, setIsNavigatingToEditor] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

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
  const pendingSnapshotRef = useRef<TSurveyGenerationDraftSnapshot | null>(null);
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
    const snapshot = pendingSnapshotRef.current;
    pendingSnapshotRef.current = null;

    if (snapshot) {
      dispatch({ type: "SNAPSHOT", snapshot });
    }
  }, []);

  const queueSnapshot = useCallback(
    (snapshot: TSurveyGenerationDraftSnapshot) => {
      pendingSnapshotRef.current = snapshot;
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
    mutationFn: (payload: TV3CreateSurveyBody) => createV3Survey(payload, "ai"),
    onSuccess: (survey) => {
      setIsNavigatingToEditor(true);
      onSuccess(survey.id);
    },
    onError: (error) => {
      dispatch({ type: "CREATE_FAILED", errorCode: getAiErrorCode(error) });
    },
  });

  const runGeneration = useCallback(async () => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await streamSurveyGeneration(
        { workspaceId, prompt: prompt.trim(), type: "link", language },
        {
          signal: controller.signal,
          onEvent: (event) => {
            // Nothing from a run the user already abandoned reaches the reducer — terminal events
            // included, since a late `done` would hand the restored draft the wrong payload.
            if (abortControllerRef.current !== controller) return;

            switch (event.type) {
              case "partial":
                queueSnapshot(event.draft);
                break;
              case "done":
                flushSnapshot();
                dispatch({ type: "DONE", payload: event.payload });
                break;
              case "error":
                dispatch({ type: "FAIL", errorCode: event.code });
                break;
              default:
                break;
            }
          },
        }
      );
    } catch (error) {
      // Stop aborts the fetch; that is the user getting what they asked for, not a failure.
      if (controller.signal.aborted) return;

      dispatch({ type: "FAIL", errorCode: getAiErrorCode(error) });
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [flushSnapshot, language, prompt, queueSnapshot, workspaceId]);

  const canCreate =
    isAIAvailable && state.status === "idle" && prompt.trim().length >= AI_SURVEY_PROMPT_MIN_LENGTH;

  const handleGenerate = useCallback(
    (event: SyntheticEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!canCreate) return;

      dispatch({ type: "SUBMIT", prompt: prompt.trim() });
      void runGeneration();
    },
    [canCreate, prompt, runGeneration]
  );

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
    discardQueuedSnapshot();
    dispatch({ type: "STOP" });
  }, [discardQueuedSnapshot]);

  const handleRegenerate = useCallback(() => {
    discardQueuedSnapshot();
    dispatch({ type: "REGENERATE", prompt: prompt.trim() });
    void runGeneration();
  }, [discardQueuedSnapshot, prompt, runGeneration]);

  const handleEditPrompt = useCallback(() => {
    abortControllerRef.current?.abort();
    discardQueuedSnapshot();
    dispatch({ type: "EDIT_PROMPT" });
  }, [discardQueuedSnapshot]);

  const handleOpenInEditor = useCallback(() => {
    if (state.status !== "review" || !state.payload) return;

    dispatch({ type: "CREATE" });
    createSurveyMutation.mutate(state.payload);
  }, [createSurveyMutation, state.payload, state.status]);

  const handleBackToDraft = useCallback(() => dispatch({ type: "BACK_TO_DRAFT" }), []);

  const clearError = useCallback(() => dispatch({ type: "CLEAR_ERROR" }), []);

  const errorMessage = useMemo(
    () => (state.errorCode === null ? null : getAiErrorMessage(state.errorCode, t)),
    [state.errorCode, t]
  );

  /**
   * The ladder only lists phases that have actually been reached. Until the model emits its first
   * JSON — which for a reasoning model is most of the wait — there is no real progress to report, so
   * the line runs uncontrolled over the two phases that are true regardless, and real signal takes
   * over the moment it arrives.
   */
  const { generatingMessages, statusIndex } = useMemo(() => {
    const messages = [
      t("workspace.surveys.ai_create.status_starting"),
      t("workspace.surveys.ai_create.status_planning"),
    ];

    if (state.draft.name) {
      messages.push(t("workspace.surveys.ai_create.status_writing_title"));
    }

    if (state.draft.questions.length > 0) {
      messages.push(
        t("workspace.surveys.ai_create.status_writing_questions", {
          count: state.draft.questions.length,
        })
      );
    }

    return {
      generatingMessages: messages,
      statusIndex: messages.length > 2 ? messages.length - 1 : undefined,
    };
  }, [state.draft.name, state.draft.questions.length, t]);

  return {
    prompt,
    setPrompt,
    status: state.status,
    draft: state.draft,
    /** The prompt the draft on screen came from, which is not always the one in the textarea. */
    submittedPrompt: state.submittedPrompt,
    canCreate,
    errorMessage,
    generatingMessages,
    statusIndex,
    isNavigatingToEditor,
    isCreatingSurvey: state.status === "creating" || isNavigatingToEditor,
    handleGenerate,
    handleStop,
    handleRegenerate,
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
