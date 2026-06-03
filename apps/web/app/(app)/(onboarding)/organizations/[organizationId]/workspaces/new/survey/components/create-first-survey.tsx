"use client";

import { PencilLineIcon, SparklesIcon, SquareLibraryIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TUserLocale } from "@formbricks/types/user";
import { OnboardingOptionsContainer } from "@/app/(app)/(onboarding)/organizations/components/OnboardingOptionsContainer";
import { CUSTOM_SURVEY_TEMPLATE_ID } from "@/app/lib/templates";
import type { TAIUnavailableReason } from "@/lib/ai/service";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { getUnavailableMessageKey } from "@/modules/survey/components/template-list/lib/ai-create-utils";
import { createSurveyFromTemplate } from "@/modules/survey/components/template-list/lib/v3-template-client";

type TOnboardingSurveyPath = "scratch" | "template" | "ai";

interface CreateFirstSurveyProps {
  organizationId: string;
  workspaceId: string;
  defaultLanguage: TUserLocale;
  isAIAvailable: boolean;
  aiUnavailableReason?: TAIUnavailableReason;
}

export const CreateFirstSurvey = ({
  organizationId,
  workspaceId,
  defaultLanguage,
  isAIAvailable,
  aiUnavailableReason,
}: Readonly<CreateFirstSurveyProps>) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [isCreatingBlankSurvey, setIsCreatingBlankSurvey] = useState(false);

  const trackPathSelected = (path: TOnboardingSurveyPath) => {
    posthog.capture("onboarding_survey_path_selected", {
      path,
      organization_id: organizationId,
      workspace_id: workspaceId,
    });
  };

  const handleStartFromScratch = async () => {
    trackPathSelected("scratch");
    setIsCreatingBlankSurvey(true);

    try {
      const survey = await createSurveyFromTemplate({
        workspaceId,
        templateId: CUSTOM_SURVEY_TEMPLATE_ID,
        source: "custom",
        surveyType: "link",
        defaultLanguage,
      });

      router.push(`/workspaces/${workspaceId}/surveys/${survey.id}/edit?mode=cx`);
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")));
    } finally {
      setIsCreatingBlankSurvey(false);
    }
  };

  const aiDisabledDescription = isAIAvailable ? undefined : t(getUnavailableMessageKey(aiUnavailableReason));

  const options = [
    {
      title: t("workspace.surveys.ai_create.create_with_ai"),
      description: t("organizations.workspaces.new.survey.create_with_ai_description"),
      icon: SparklesIcon,
      disabled: !isAIAvailable,
      disabledDescription: aiDisabledDescription,
      onClick: () => {
        trackPathSelected("ai");
        router.push(`/organizations/${organizationId}/workspaces/new/ai`);
      },
    },
    {
      title: t("organizations.workspaces.new.survey.use_template"),
      description: t("organizations.workspaces.new.survey.use_template_description"),
      icon: SquareLibraryIcon,
      onClick: () => {
        trackPathSelected("template");
        router.push(`/organizations/${organizationId}/workspaces/new/templates`);
      },
    },
    {
      title: t("organizations.workspaces.new.survey.start_from_scratch"),
      description: t("organizations.workspaces.new.survey.start_from_scratch_description"),
      icon: PencilLineIcon,
      onClick: () => void handleStartFromScratch(),
      isLoading: isCreatingBlankSurvey,
    },
  ];

  return <OnboardingOptionsContainer options={options} />;
};
