"use client";

import { type SyntheticEvent, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TUserLocale } from "@formbricks/types/user";
import type { TV3SurveyGenerateBody } from "@/app/api/v3/surveys/generate/schemas";
import { AI_SURVEY_PROMPT_MIN_LENGTH } from "@/modules/survey/components/template-list/lib/ai-create-utils";
import { streamSurveyGeneration } from "@/modules/survey/components/template-list/lib/ai-generate-stream-client";
import { createV3Survey } from "@/modules/survey/list/lib/v3-surveys-client";
import { useDraftCreation } from "./use-draft-creation";

type UseCreateSurveyWithAIProps = {
  workspaceId: string;
  language: TUserLocale;
  isAIAvailable: boolean;
  onSuccess: (surveyId: string) => void;
};

/**
 * Create with AI: a prompt in, a reviewed draft out. The machinery — state machine, snapshot
 * buffering, abort, unload guard — lives in `useDraftCreation`; this hook only supplies the prompt
 * textarea state, the generation stream and the length gate.
 */
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

  // What both entry points need: AI on, and a prompt worth sending.
  const hasUsablePrompt = isAIAvailable && prompt.trim().length >= AI_SURVEY_PROMPT_MIN_LENGTH;

  const stream = useCallback(
    (body: TV3SurveyGenerateBody, handlers: Parameters<typeof streamSurveyGeneration>[1]) =>
      streamSurveyGeneration(body, handlers),
    []
  );

  const create = useCallback(
    (payload: Parameters<typeof createV3Survey>[0]) => createV3Survey(payload, "ai"),
    []
  );

  const draft = useDraftCreation<TV3SurveyGenerateBody>({
    stream,
    create,
    canSubmit: hasUsablePrompt,
    getSourceLabel: (body) => body.prompt,
    sourceKind: "prompt",
    onSuccess,
  });

  const buildBody = useCallback(
    (): TV3SurveyGenerateBody => ({ workspaceId, prompt: prompt.trim(), type: "link", language }),
    [language, prompt, workspaceId]
  );

  const handleGenerate = useCallback(
    (event: SyntheticEvent<HTMLFormElement>) => draft.submit(buildBody(), event),
    [buildBody, draft]
  );

  const handleRegenerate = useCallback(() => draft.regenerate(buildBody()), [buildBody, draft]);

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

    if (draft.draft.name) {
      messages.push(t("workspace.surveys.ai_create.status_writing_title"));
    }

    if (draft.draft.questions.length > 0) {
      messages.push(
        t("workspace.surveys.ai_create.status_writing_questions", {
          count: draft.draft.questions.length,
        })
      );
    }

    return {
      generatingMessages: messages,
      statusIndex: messages.length > 2 ? messages.length - 1 : undefined,
    };
  }, [draft.draft.name, draft.draft.questions.length, t]);

  return {
    prompt,
    setPrompt,
    status: draft.status,
    draft: draft.draft,
    /** The prompt the draft on screen came from, which is not always the one in the textarea. */
    submittedPrompt: draft.sourceLabel,
    canCreate: draft.canCreate,
    errorMessage: draft.errorMessage,
    generatingMessages,
    statusIndex,
    isNavigatingToEditor: draft.isNavigatingToEditor,
    isCreatingSurvey: draft.isCreatingSurvey,
    handleGenerate,
    handleStop: draft.handleStop,
    handleRegenerate,
    handleEditPrompt: draft.handleEditPrompt,
    handleBackToDraft: draft.handleBackToDraft,
    handleOpenInEditor: draft.handleOpenInEditor,
    clearError: draft.clearError,
    hasKeptDraft: draft.hasKeptDraft,
    hasUnsavedWork: draft.hasUnsavedWork,
  };
};
