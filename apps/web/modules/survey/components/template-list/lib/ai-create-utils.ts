import type { TFunction } from "i18next";
import {
  BarChart3Icon,
  type LucideIcon,
  MousePointerClickIcon,
  TrendingDownIcon,
  UsersIcon,
} from "lucide-react";

export const AI_SURVEY_PROMPT_MIN_LENGTH = 4;
export const AI_SURVEY_PROMPT_MAX_LENGTH = 1200;

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
