"use client";

import Link from "next/link";
import { type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { TUserLocale } from "@formbricks/types/user";
import { useWorkspace } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import { getAIUnavailableAction } from "@/lib/ai/availability";
import type { TAIUnavailableReason } from "@/lib/ai/service";
import { AiDraftPreview } from "@/modules/survey/components/template-list/components/ai-draft-preview";
import { useCreateSurveyWithAI } from "@/modules/survey/components/template-list/hooks/use-create-survey-with-ai";
import {
  AI_SURVEY_PROMPT_MAX_LENGTH,
  getHelperPrompts,
  getUnavailableMessageKey,
} from "@/modules/survey/components/template-list/lib/ai-create-utils";
import { AiIcon, AiStatusLine } from "@/modules/ui/components/ai";
import { Alert, AlertButton, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";

type CreateWithAIFormProps = {
  workspaceId: string;
  language: TUserLocale;
  isAIAvailable: boolean;
  aiUnavailableReason?: TAIUnavailableReason;
  onSuccess: (surveyId: string) => void;
  onCancel?: () => void;
  showCancel?: boolean;
  /**
   * The host supplies the footer *shell* only — `<DialogFooter>` in a dialog, a plain row on a
   * page. The buttons themselves are built here, because with three states and state-dependent
   * actions every host would otherwise duplicate the same switch.
   */
  renderFooter?: (footer: ReactNode) => ReactNode;
  promptInputRef?: React.Ref<HTMLTextAreaElement>;
  /** True while the host is navigating away, so the review primary can stay in its loading state. */
  isHostNavigating?: boolean;
  /** Reports whether closing now would discard an in-flight generation or an unopened draft. */
  onUnsavedWorkChange?: (hasUnsavedWork: boolean) => void;
  /** Reports whether a generation is in flight, so the host can word its confirmation. */
  onGeneratingChange?: (isGenerating: boolean) => void;
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
  isHostNavigating = false,
  onUnsavedWorkChange,
  onGeneratingChange,
}: Readonly<CreateWithAIFormProps>) => {
  const { t } = useTranslation();
  const { workspace } = useWorkspace();

  const {
    prompt,
    setPrompt,
    status,
    draft,
    canCreate,
    errorMessage,
    generatingMessages,
    statusIndex,
    isCreatingSurvey,
    handleGenerate,
    handleStop,
    handleRegenerate,
    handleEditPrompt,
    handleBackToDraft,
    handleOpenInEditor,
    clearError,
    hasKeptDraft,
    hasUnsavedWork,
  } = useCreateSurveyWithAI({ workspaceId, language, isAIAvailable, onSuccess });

  const stopButtonRef = useRef<HTMLButtonElement>(null);
  const draftRef = useRef<HTMLDivElement>(null);

  const isGenerating = status === "generating";
  const isReviewing = status === "review" || status === "creating";

  // The textarea unmounts when generation starts, so without this focus falls to <body> and a
  // keyboard user is stranded. Stop is the only action available, so it is where focus belongs.
  useEffect(() => {
    if (isGenerating) {
      stopButtonRef.current?.focus();
    }
  }, [isGenerating]);

  useEffect(() => {
    onUnsavedWorkChange?.(hasUnsavedWork);
  }, [hasUnsavedWork, onUnsavedWorkChange]);

  useEffect(() => {
    onGeneratingChange?.(isGenerating);
  }, [isGenerating, onGeneratingChange]);

  // On completion focus the draft rather than "Open in editor": the card is scrollable, and a user
  // pressing Space to read further would otherwise navigate by accident.
  useEffect(() => {
    if (status === "review") {
      draftRef.current?.focus();
    }
  }, [status]);

  const unavailableAction = workspace?.organizationId
    ? getAIUnavailableAction(aiUnavailableReason, workspace.organizationId)
    : undefined;
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

  const buildFooter = () => {
    if (isGenerating) {
      // One action while generating. A disabled primary next to it would only invite clicking.
      return (
        <Button ref={stopButtonRef} type="button" variant="secondary" onClick={handleStop}>
          {t("workspace.surveys.ai_create.stop")}
        </Button>
      );
    }

    if (isReviewing) {
      return (
        <>
          <Button type="button" variant="secondary" disabled={isCreatingSurvey} onClick={handleRegenerate}>
            {t("workspace.surveys.ai_create.regenerate")}
          </Button>
          {/* `loading` is right here and wrong while generating: this is an ordinary save, and a
              spinner reads as "saving". Thinking gets the twinkling mark instead. */}
          <Button type="button" loading={isCreatingSurvey || isHostNavigating} onClick={handleOpenInEditor}>
            {t("workspace.surveys.ai_create.open_in_editor")}
          </Button>
        </>
      );
    }

    return (
      <>
        {showCancel && onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
        )}
        {hasKeptDraft && (
          <Button type="button" variant="secondary" onClick={handleBackToDraft}>
            {t("workspace.surveys.ai_create.back_to_draft")}
          </Button>
        )}
        <Button type="submit" disabled={!canCreate}>
          <AiIcon tone="inherit" />
          {t("workspace.surveys.ai_create.create")}
        </Button>
      </>
    );
  };

  const footer = buildFooter();
  // mt-auto pins the footer to the bottom of the fixed frame, so it does not drift up in the
  // shorter idle state.
  const footerContent = renderFooter ? (
    <div className="mt-auto">{renderFooter(footer)}</div>
  ) : (
    <div className="mt-auto flex justify-end gap-2">{footer}</div>
  );

  const promptChip = (
    <div className="flex items-center gap-2 text-xs text-slate-500">
      <span className="min-w-0 flex-1 truncate">
        {t("workspace.surveys.ai_create.your_prompt")}: {prompt}
      </span>
      <Button type="button" variant="ghost" size="sm" disabled={isCreatingSurvey} onClick={handleEditPrompt}>
        {t("workspace.surveys.ai_create.edit_prompt")}
      </Button>
    </div>
  );

  return (
    <form className="flex h-full w-full flex-col space-y-4" onSubmit={handleGenerate}>
      {!isAIAvailable && (
        <Alert variant="info" role="status">
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

      {isGenerating || isReviewing ? (
        <>
          <div className="shrink-0">{promptChip}</div>
          <div
            ref={draftRef}
            tabIndex={-1}
            className="flex min-h-0 flex-1 flex-col focus-visible:outline-hidden">
            <AiDraftPreview draft={draft} isGenerating={isGenerating} className="flex-1" />
          </div>
          <AiStatusLine isActive={isGenerating} messages={generatingMessages} activeIndex={statusIndex} />
        </>
      ) : (
        <>
          <div className="space-y-2">
            <textarea
              ref={promptInputRef}
              id="ai-survey-prompt"
              className="min-h-24 w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 focus:outline-hidden disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
              maxLength={AI_SURVEY_PROMPT_MAX_LENGTH}
              placeholder={t("workspace.surveys.ai_create.prompt_placeholder")}
              value={prompt}
              disabled={!isAIAvailable}
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

          {isAIAvailable && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">
                {t("workspace.surveys.ai_create.try_prompt")}
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {helperPrompts.map((helperPrompt) => (
                  <Button
                    key={helperPrompt.label}
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="group w-full min-w-0 justify-start text-left"
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
        </>
      )}

      {footerContent}
    </form>
  );
};
