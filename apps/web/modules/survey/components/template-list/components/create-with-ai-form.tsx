"use client";

import { SparklesIcon } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TUserLocale } from "@formbricks/types/user";
import type { TAIUnavailableReason } from "@/lib/ai/service";
import { AIUnavailableAlert } from "@/modules/ai/components/ai-unavailable-alert";
import { useCreateSurveyWithAI } from "@/modules/survey/components/template-list/hooks/use-create-survey-with-ai";
import {
  AI_SURVEY_PROMPT_MAX_LENGTH,
  getHelperPrompts,
} from "@/modules/survey/components/template-list/lib/ai-create-utils";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";

export type TCreateWithAIFormFooterProps = {
  isBusy: boolean;
  canCreate: boolean;
  submitLabel: string;
};

type CreateWithAIFormProps = {
  workspaceId: string;
  language: TUserLocale;
  isAIAvailable: boolean;
  aiUnavailableReason?: TAIUnavailableReason;
  onSuccess: (surveyId: string) => void;
  onCancel?: () => void;
  showCancel?: boolean;
  renderFooter?: (props: TCreateWithAIFormFooterProps) => ReactNode;
  promptInputRef?: React.Ref<HTMLTextAreaElement>;
};

export const CreateWithAIForm = ({
  workspaceId,
  language,
  isAIAvailable,
  aiUnavailableReason,
  onSuccess,
  onCancel,
  showCancel = true,
  renderFooter,
  promptInputRef,
}: Readonly<CreateWithAIFormProps>) => {
  const { t } = useTranslation();

  const { prompt, setPrompt, isBusy, canCreate, errorMessage, handleGenerate, clearError, submitLabel } =
    useCreateSurveyWithAI({
      workspaceId,
      language,
      isAIAvailable,
      onSuccess,
    });

  const helperPrompts = useMemo(() => getHelperPrompts(t), [t]);

  const handlePromptKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  // Nothing on this form can be submitted without AI, so the alert stands on its own rather than
  // sitting above a disabled textarea and an unusable Create button.
  if (!isAIAvailable) {
    return (
      <AIUnavailableAlert
        title={t("workspace.surveys.ai_create.ai_survey_creation")}
        reason={aiUnavailableReason}
        feature="ai_survey_creation"
      />
    );
  }

  const defaultFooter = (
    <div className="flex justify-end gap-2">
      {showCancel && onCancel && (
        <Button type="button" variant="secondary" disabled={isBusy} onClick={onCancel}>
          {t("common.cancel")}
        </Button>
      )}
      <Button type="submit" loading={isBusy} disabled={!canCreate}>
        {!isBusy && <SparklesIcon />}
        {submitLabel}
      </Button>
    </div>
  );

  const footerContent = renderFooter ? renderFooter({ isBusy, canCreate, submitLabel }) : defaultFooter;

  return (
    <form className="flex w-full flex-col space-y-4" onSubmit={handleGenerate}>
      {errorMessage && (
        <Alert variant="error">
          <AlertTitle>{t("common.error")}</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <textarea
          ref={promptInputRef}
          id="ai-survey-prompt"
          className="min-h-24 w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 focus:outline-hidden disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
          maxLength={AI_SURVEY_PROMPT_MAX_LENGTH}
          placeholder={t("workspace.surveys.ai_create.prompt_placeholder")}
          value={prompt}
          disabled={isBusy}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={handlePromptKeyDown}
          aria-label={t("workspace.surveys.ai_create.prompt_label")}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            {t("workspace.surveys.ai_create.characters", {
              count: prompt.length,
              max: AI_SURVEY_PROMPT_MAX_LENGTH,
            })}
          </span>
          <span>{t("workspace.surveys.ai_create.shortcut_hint")}</span>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-700">{t("workspace.surveys.ai_create.try_prompt")}</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {helperPrompts.map((helperPrompt) => (
            <Button
              key={helperPrompt.label}
              type="button"
              variant="secondary"
              size="sm"
              className="group w-full min-w-0 justify-start text-left"
              disabled={isBusy}
              title={helperPrompt.prompt}
              aria-label={`${helperPrompt.label}. ${helperPrompt.prompt}`}
              onClick={() => {
                setPrompt(helperPrompt.prompt);
                clearError();
              }}>
              <helperPrompt.Icon className="size-3.5 shrink-0 text-slate-500 transition-colors group-hover:text-primary" />
              <span className="min-w-0 truncate">{helperPrompt.label}</span>
            </Button>
          ))}
        </div>
      </div>

      {footerContent}
    </form>
  );
};
