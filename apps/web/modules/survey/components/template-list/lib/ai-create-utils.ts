import type { TFunction } from "i18next";
import {
  BarChart3Icon,
  type LucideIcon,
  MousePointerClickIcon,
  TrendingDownIcon,
  UsersIcon,
} from "lucide-react";
import type { TAIUnavailableReason } from "@/lib/ai/service";

export const AI_SURVEY_PROMPT_MIN_LENGTH = 4;
export const AI_SURVEY_PROMPT_MAX_LENGTH = 1200;

export type TSurveyGenerationType = "link";

export const SURVEY_TYPE_OPTIONS: { value: TSurveyGenerationType }[] = [{ value: "link" }];

export const getUnavailableMessageKey = (reason?: TAIUnavailableReason) => {
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

export const getHelperPrompts = (
  t: TFunction
): {
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
];
