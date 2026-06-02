"use client";

import {
  BarChart3Icon,
  type LucideIcon,
  MousePointerClickIcon,
  SparklesIcon,
  TrendingDownIcon,
  UsersIcon,
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
  useTransition,
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

const AI_SURVEY_PROMPT_MIN_LENGTH = 4;
const AI_SURVEY_PROMPT_MAX_LENGTH = 1200;

type TSurveyGenerationType = "link";
type TFormSubmitEvent = Parameters<NonNullable<ComponentPropsWithoutRef<"form">["onSubmit"]>>[0];
type TSurveyTypeOption = {
  value: TSurveyGenerationType;
};

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
  if (reason === "read_only") {
    return "workspace.surveys.read_only_user_not_allowed_to_create_survey_warning";
  }
  if (reason === "not_in_plan") return "workspace.surveys.ai_create.ai_not_in_plan";
  if (reason === "not_enabled") return "workspace.surveys.ai_create.ai_not_enabled";
  if (reason === "instance_not_configured") {
    return "workspace.surveys.ai_create.ai_instance_not_configured";
  }
  return "workspace.surveys.ai_create.ai_not_available";
};

const SURVEY_TYPE_OPTIONS: TSurveyTypeOption[] = [
  {
    value: "link",
  },
];

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
  const [isCreatingSurvey, setIsCreatingSurvey] = useState(false);
  const [isNavigatingToEditor, startEditorNavigationTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const isBusy = isCreatingSurvey || isNavigatingToEditor;
  const canCreate = isAIAvailable && !isBusy && prompt.trim().length >= AI_SURVEY_PROMPT_MIN_LENGTH;
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
    if (isBusy && !options?.force) return;

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
        type: surveyType,
        language,
      });
      const validation = await validateSurveyCreatePayload(generatedSurvey.payload);

      if (!generatedSurvey.validation.valid || !validation.valid) {
        setErrorMessage(t("workspace.surveys.ai_create.generated_payload_invalid"));
        return;
      }

      const survey = await createV3Survey(generatedSurvey.payload);
      startEditorNavigationTransition(() => {
        router.push(`/workspaces/${workspaceId}/surveys/${survey.id}/edit`);
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsCreatingSurvey(false);
    }
  };

  const handlePromptKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const handleOpenAutoFocus = (event: Event) => {
    if (!isAIAvailable || isBusy) return;

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
        className="overflow-hidden"
        onOpenAutoFocus={handleOpenAutoFocus}
        disableCloseOnOutsideClick={isBusy}>
        <form className="flex min-h-0 flex-1 flex-col space-y-4" onSubmit={handleGenerate}>
          <DialogHeader>
            <SparklesIcon aria-hidden="true" />
            <DialogTitle>{t("workspace.surveys.ai_create.dialog_title")}</DialogTitle>
            <DialogDescription>{t("workspace.surveys.ai_create.dialog_description")}</DialogDescription>
          </DialogHeader>

          <DialogBody className="-mx-1 space-y-4 px-1 pb-1">
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
                      disabled={isBusy}
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

          <DialogFooter>
            <Button type="button" variant="secondary" disabled={isBusy} onClick={() => setDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={isBusy} disabled={!canCreate}>
              {!isBusy && <SparklesIcon />}
              {isNavigatingToEditor
                ? t("workspace.surveys.ai_create.opening_editor")
                : isCreatingSurvey
                  ? t("workspace.surveys.ai_create.creating")
                  : t("workspace.surveys.ai_create.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
