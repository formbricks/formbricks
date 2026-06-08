"use client";

import { PencilLineIcon, SparklesIcon, SquareLibraryIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TSurveyCreateInput } from "@formbricks/types/surveys/types";
import { OnboardingOptionsContainer } from "@/app/(app)/(onboarding)/organizations/components/OnboardingOptionsContainer";
import { customSurveyTemplate } from "@/app/lib/templates";
import type { TAIUnavailableReason } from "@/lib/ai/service";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { createSurveyAction } from "@/modules/survey/components/template-list/actions";
import { getUnavailableMessageKey } from "@/modules/survey/components/template-list/lib/ai-create-utils";

type TOnboardingSurveyPath = "scratch" | "template" | "ai";

interface CreateFirstSurveyProps {
  organizationId: string;
  workspaceId: string;
  userId: string;
  isAIAvailable: boolean;
  aiUnavailableReason?: TAIUnavailableReason;
}

export const CreateFirstSurvey = ({
  organizationId,
  workspaceId,
  userId,
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
      const customSurvey = customSurveyTemplate(t);
      const surveyBody: TSurveyCreateInput = {
        ...customSurvey.preset,
        type: "link",
        createdBy: userId,
      };

      const response = await createSurveyAction({
        workspaceId,
        surveyBody,
        createdFrom: "blank",
      });

      if (response?.data) {
        router.push(`/workspaces/${workspaceId}/surveys/${response.data.id}/edit?mode=cx`);
        return;
      }

      toast.error(getFormattedErrorMessage(response));
    } catch {
      toast.error(t("common.something_went_wrong_please_try_again"));
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
