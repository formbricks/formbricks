"use client";

import {
  BarChart3Icon,
  type LucideIcon,
  MousePointerClickIcon,
  SparklesIcon,
  TrendingDownIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
  type ReactNode,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import type { TUserLocale } from "@formbricks/types/user";
import { V3ApiError, getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import {
  type TAIUnavailableReason,
  getAIUnavailableAction,
} from "@/modules/ee/analysis/charts/lib/ai-availability";
import {
  createV3Survey,
  generateSurveyCreatePayload,
  validateSurveyCreatePayload,
} from "@/modules/survey/list/lib/v3-surveys-client";
import { Alert, AlertButton, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/modules/ui/components/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";

const AI_SURVEY_PROMPT_MIN_LENGTH = 24;
const AI_SURVEY_PROMPT_MAX_LENGTH = 1200;

type TSurveyGenerationType = "link";
type TFormSubmitEvent = Parameters<NonNullable<ComponentPropsWithoutRef<"form">["onSubmit"]>>[0];

type CreateWithAIDialogProps = {
  workspaceId: string;
  language: TUserLocale;
  isAIAvailable: boolean;
  aiUnavailableReason?: TAIUnavailableReason;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const getUnavailableMessageKey = (reason?: TAIUnavailableReason) => {
  if (reason === "not_in_plan") return "workspace.surveys.ai_create.ai_not_in_plan";
  if (reason === "not_enabled") return "workspace.surveys.ai_create.ai_not_enabled";
  if (reason === "instance_not_configured") {
    return "workspace.surveys.ai_create.ai_instance_not_configured";
  }
  return "workspace.surveys.ai_create.ai_not_available";
};

export const CreateWithAIDialog = ({
  workspaceId,
  language,
  isAIAvailable,
  aiUnavailableReason,
  trigger,
  open,
  onOpenChange,
}: Readonly<CreateWithAIDialogProps>) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [surveyType, setSurveyType] = useState<TSurveyGenerationType>("link");
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const unavailableAction = getAIUnavailableAction(aiUnavailableReason, workspaceId);
  let unavailableActionLabel: string | undefined;
  if (unavailableAction?.type === "enable_ai") {
    unavailableActionLabel = t("workspace.surveys.ai_create.enable_ai_in_settings");
  } else if (unavailableAction?.type === "upgrade_plan") {
    unavailableActionLabel = t("workspace.surveys.ai_create.upgrade_plan");
  }

  const helperPrompts = useMemo(
    (): {
      label: string;
      prompt: string;
      Icon: LucideIcon;
    }[] => [
      {
        label: t("workspace.surveys.ai_create.prompt_helper_onboarding_label"),
        prompt: t("workspace.surveys.ai_create.prompt_helper_onboarding"),
        Icon: MousePointerClickIcon,
      },
      {
        label: t("workspace.surveys.ai_create.prompt_helper_churn_label"),
        prompt: t("workspace.surveys.ai_create.prompt_helper_churn"),
        Icon: UsersIcon,
      },
      {
        label: t("workspace.surveys.ai_create.prompt_helper_pmf_label"),
        prompt: t("workspace.surveys.ai_create.prompt_helper_pmf"),
        Icon: BarChart3Icon,
      },
      {
        label: t("workspace.surveys.ai_create.prompt_helper_website_label"),
        prompt: t("workspace.surveys.ai_create.prompt_helper_website"),
        Icon: TrendingDownIcon,
      },
    ],
    [t]
  );

  const setDialogOpen = (nextOpen: boolean, options?: { force?: boolean }) => {
    if (isGenerating && !options?.force) return;

    if (!nextOpen) {
      setErrorMessage(null);
    }

    if (!isControlled) {
      setInternalOpen(nextOpen);
    }

    onOpenChange?.(nextOpen);
  };

  const getErrorMessage = (error: unknown) => {
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
    }

    return getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again"));
  };

  const handleGenerate = async (event: TFormSubmitEvent) => {
    event.preventDefault();

    if (!isAIAvailable) {
      return;
    }

    const trimmedPrompt = prompt.trim();
    if (trimmedPrompt.length < AI_SURVEY_PROMPT_MIN_LENGTH) {
      setErrorMessage(t("workspace.surveys.ai_create.prompt_too_short"));
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const generatedSurvey = await generateSurveyCreatePayload({
        workspaceId,
        prompt: trimmedPrompt,
        type: surveyType,
        language,
      });
      const validation = await validateSurveyCreatePayload(generatedSurvey.payload);

      if (!generatedSurvey.validation.valid || !validation.valid) {
        setErrorMessage(t("workspace.surveys.ai_create.generated_payload_invalid"));
        return;
      }

      const survey = await createV3Survey(generatedSurvey.payload);
      setDialogOpen(false, { force: true });
      router.push(`/workspaces/${workspaceId}/surveys/${survey.id}/edit`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePromptKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const handleOpenAutoFocus = (event: Event) => {
    if (!isAIAvailable || isGenerating) return;

    event.preventDefault();
    globalThis.requestAnimationFrame(() => {
      promptTextareaRef.current?.focus();
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setDialogOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent
        width="narrow"
        className="space-y-0 overflow-hidden p-0"
        hideCloseButton
        onOpenAutoFocus={handleOpenAutoFocus}
        disableCloseOnOutsideClick={isGenerating}>
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleGenerate}>
          <DialogHeader className="relative top-0 border-b border-slate-200 px-5 py-4">
            <button
              type="button"
              className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
              disabled={isGenerating}
              aria-label={t("common.close")}
              onClick={() => setDialogOpen(false)}>
              <XIcon className="size-4" />
            </button>
            <div className="flex items-start gap-3 pr-10">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-brand-dark bg-white text-brand-dark">
                <SparklesIcon className="size-4" />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-base font-semibold leading-6">
                  {t("workspace.surveys.ai_create.dialog_title")}
                </DialogTitle>
                <DialogDescription className="leading-5">
                  {t("workspace.surveys.ai_create.dialog_description")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <DialogBody className="space-y-4 px-5 py-4">
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

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="ai-survey-type">
                {t("workspace.surveys.ai_create.survey_type_label")}
              </label>
              <Select
                value={surveyType}
                onValueChange={(value) => setSurveyType(value as TSurveyGenerationType)}
                disabled={isGenerating || !isAIAvailable}>
                <SelectTrigger id="ai-survey-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="link">{t("workspace.surveys.ai_create.link_survey")}</SelectItem>
                  <SelectItem value="app" disabled>
                    {t("workspace.surveys.ai_create.app_survey")}
                  </SelectItem>
                  <SelectItem value="website" disabled>
                    {t("workspace.surveys.ai_create.website_survey")}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">{t("workspace.surveys.ai_create.only_link_supported")}</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="ai-survey-prompt">
                {t("workspace.surveys.ai_create.prompt_label")}
              </label>
              <textarea
                ref={promptTextareaRef}
                id="ai-survey-prompt"
                className="min-h-24 w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                maxLength={AI_SURVEY_PROMPT_MAX_LENGTH}
                placeholder={t("workspace.surveys.ai_create.prompt_placeholder")}
                value={prompt}
                disabled={isGenerating || !isAIAvailable}
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
                      disabled={isGenerating}
                      title={helperPrompt.prompt}
                      aria-label={`${helperPrompt.label}. ${helperPrompt.prompt}`}
                      onClick={() => {
                        setPrompt(helperPrompt.prompt);
                        setErrorMessage(null);
                      }}>
                      <helperPrompt.Icon className="size-3.5 shrink-0 text-slate-500 transition-colors group-hover:text-primary" />
                      <span className="min-w-0 truncate">{helperPrompt.label}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </DialogBody>

          <DialogFooter className="border-t border-slate-200 px-5 py-3">
            <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={isGenerating} disabled={!isAIAvailable}>
              <SparklesIcon />
              {isGenerating
                ? t("workspace.surveys.ai_create.generating")
                : t("workspace.surveys.ai_create.generate")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
