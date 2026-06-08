"use client";

import { SparklesIcon } from "lucide-react";
import Link from "next/link";
import { type KeyboardEvent, type ReactNode, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TUserLocale } from "@formbricks/types/user";
import { getAIUnavailableAction } from "@/lib/ai/availability";
import type { TAIUnavailableReason } from "@/lib/ai/service";
import { useCreateSurveyWithAI } from "@/modules/survey/components/template-list/hooks/use-create-survey-with-ai";
import {
  AI_SURVEY_PROMPT_MAX_LENGTH,
  SURVEY_TYPE_OPTIONS,
  getHelperPrompts,
  getUnavailableMessageKey,
} from "@/modules/survey/components/template-list/lib/ai-create-utils";
import { Alert, AlertButton, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";

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
  showSurveyType?: boolean;
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
  showSurveyType = true,
  renderFooter,
  promptInputRef,
}: Readonly<CreateWithAIFormProps>) => {
  const { t } = useTranslation();

  const {
    prompt,
    setPrompt,
    surveyType,
    setSurveyType,
    isBusy,
    canCreate,
    errorMessage,
    handleGenerate,
    clearError,
    submitLabel,
  } = useCreateSurveyWithAI({
    workspaceId,
    language,
    isAIAvailable,
    onSuccess,
  });

  const unavailableAction = getAIUnavailableAction(aiUnavailableReason, workspaceId);
  let unavailableActionLabel: string | undefined;
  if (unavailableAction?.type === "enable_ai") {
    unavailableActionLabel = t("workspace.surveys.ai_create.enable_ai_in_settings");
  } else if (unavailableAction?.type === "upgrade_plan") {
    unavailableActionLabel = t("workspace.surveys.ai_create.upgrade_plan");
  }

  const helperPrompts = useMemo(() => getHelperPrompts(t), [t]);

  const handlePromptKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

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
      {!isAIAvailable && (
        <Alert variant="info">
          <AlertTitle>{t("workspace.surveys.ai_create.ai_not_available")}</AlertTitle>
          <AlertDescription>{t(getUnavailableMessageKey(aiUnavailableReason))}</AlertDescription>
          {unavailableAction && unavailableActionLabel && (
            <AlertButton asChild>
              <Link href={unavailableAction.href}>{unavailableActionLabel}</Link>
            </AlertButton>
          )}
        </Alert>
      )}

      {errorMessage && (
        <Alert variant="error">
          <AlertTitle>{t("common.error")}</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {showSurveyType && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="ai-survey-type">
            {t("workspace.surveys.ai_create.survey_type_label")}
          </label>
          <Select
            value={surveyType}
            onValueChange={(value) => setSurveyType(value as typeof surveyType)}
            disabled={isBusy || !isAIAvailable || SURVEY_TYPE_OPTIONS.length <= 1}>
            <SelectTrigger id="ai-survey-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SURVEY_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t("workspace.surveys.ai_create.link_survey")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-500">{t("workspace.surveys.ai_create.only_link_supported")}</p>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="ai-survey-prompt">
          {t("workspace.surveys.ai_create.prompt_label")}
        </label>
        <textarea
          ref={promptInputRef}
          id="ai-survey-prompt"
          className="min-h-24 w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
          maxLength={AI_SURVEY_PROMPT_MAX_LENGTH}
          placeholder={t("workspace.surveys.ai_create.prompt_placeholder")}
          value={prompt}
          disabled={isBusy || !isAIAvailable}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={handlePromptKeyDown}
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

      {isAIAvailable && (
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
      )}

      {footerContent}
    </form>
  );
};
