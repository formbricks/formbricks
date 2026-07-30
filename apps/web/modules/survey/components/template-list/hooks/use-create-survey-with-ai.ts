"use client";

import { type SyntheticEvent, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TUserLocale } from "@formbricks/types/user";
import { V3ApiError, getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { AI_SURVEY_PROMPT_MIN_LENGTH } from "@/modules/survey/components/template-list/lib/ai-create-utils";
import {
  createV3Survey,
  generateSurveyCreatePayload,
  validateSurveyCreatePayload,
} from "@/modules/survey/list/lib/v3-surveys-client";

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
  const [prompt, setPrompt] = useState("");
  const [isCreatingSurvey, setIsCreatingSurvey] = useState(false);
  const [isNavigatingToEditor, setIsNavigatingToEditor] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isBusy = isCreatingSurvey || isNavigatingToEditor;
  const canCreate = isAIAvailable && !isBusy && prompt.trim().length >= AI_SURVEY_PROMPT_MIN_LENGTH;

  const getErrorMessage = useCallback(
    (error: unknown) => {
      if (error instanceof V3ApiError) {
        if (error.code === "ai_features_not_enabled") {
          return t("workspace.surveys.ai_create.ai_not_in_plan");
        }

        if (error.code === "ai_smart_tools_disabled") {
          return t("workspace.surveys.ai_create.ai_not_enabled");
        }

        if (error.code === "ai_instance_not_configured") {
          return t("workspace.surveys.ai_create.ai_instance_not_configured");
        }

        if (error.code === "ai_generated_payload_invalid") {
          return t("workspace.surveys.ai_create.generated_payload_invalid");
        }

        if (error.code === "ai_output_too_long") {
          return t("workspace.surveys.ai_create.ai_output_too_long");
        }
      }

      return getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again"));
    },
    [t]
  );

  const handleGenerate = useCallback(
    async (event: SyntheticEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!canCreate) {
        return;
      }

      const trimmedPrompt = prompt.trim();

      setIsCreatingSurvey(true);
      setErrorMessage(null);

      try {
        const generatedSurvey = await generateSurveyCreatePayload({
          workspaceId,
          prompt: trimmedPrompt,
          type: "link",
          language,
        });
        const validation = await validateSurveyCreatePayload(generatedSurvey.payload);

        if (!generatedSurvey.validation.valid || !validation.valid) {
          setErrorMessage(t("workspace.surveys.ai_create.generated_payload_invalid"));
          return;
        }

        const survey = await createV3Survey(generatedSurvey.payload, "ai");
        setIsNavigatingToEditor(true);
        onSuccess(survey.id);
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
        setIsNavigatingToEditor(false);
      } finally {
        setIsCreatingSurvey(false);
      }
    },
    [canCreate, getErrorMessage, language, onSuccess, prompt, t, workspaceId]
  );

  const clearError = useCallback(() => setErrorMessage(null), []);

  const submitLabel = useMemo(() => {
    if (isNavigatingToEditor) {
      return t("workspace.surveys.ai_create.opening_editor");
    }
    if (isCreatingSurvey) {
      return t("workspace.surveys.ai_create.creating");
    }
    return t("workspace.surveys.ai_create.create");
  }, [isCreatingSurvey, isNavigatingToEditor, t]);

  return {
    prompt,
    setPrompt,
    isBusy,
    canCreate,
    errorMessage,
    handleGenerate,
    clearError,
    submitLabel,
  };
};
