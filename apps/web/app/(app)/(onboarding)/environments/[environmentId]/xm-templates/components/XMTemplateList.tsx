"use client";

import { replacePresetPlaceholders } from "@/app/(app)/(onboarding)/environments/[environmentId]/xm-templates/lib/utils";
import { getXMTemplates } from "@/app/(app)/(onboarding)/environments/[environmentId]/xm-templates/lib/xm-templates";
import { OnboardingOptionsContainer } from "@/app/(app)/(onboarding)/organizations/components/OnboardingOptionsContainer";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { createSurveyAction } from "@/modules/survey/components/template-list/actions";
import { useTranslate } from "@tolgee/react";
import { ActivityIcon, ShoppingCartIcon, SmileIcon, StarIcon, ThumbsUpIcon, UsersIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { TProject } from "@formbricks/types/project";
import { TSurveyCreateInput } from "@formbricks/types/surveys/types";
import { TXMTemplate } from "@formbricks/types/templates";
import { TUser } from "@formbricks/types/user";

interface XMTemplateListProps {
  project: TProject;
  user: TUser;
  environmentId: string;
}

export const XMTemplateList = ({ project, user, environmentId }: XMTemplateListProps) => {
  const [activeTemplateId, setActiveTemplateId] = useState<number | null>(null);
  const { t } = useTranslate();
  const router = useRouter();

  const createSurvey = async (activeTemplate: TXMTemplate) => {
    const augmentedTemplate: TSurveyCreateInput = {
      ...activeTemplate,
      type: "link",
      createdBy: user.id,
      environmentId: environmentId,
    };
    const createSurveyResponse = await createSurveyAction({
      environmentId: environmentId,
      surveyBody: augmentedTemplate,
    });

    if (createSurveyResponse?.data) {
      router.push(`/environments/${environmentId}/surveys/${createSurveyResponse.data.id}/edit?mode=cx`);
    } else {
      const errorMessage = getFormattedErrorMessage(createSurveyResponse);
      toast.error(errorMessage);
    }
  };

  const handleTemplateClick = (templateIdx: number) => {
    setActiveTemplateId(templateIdx);
    const template = getXMTemplates(t)[templateIdx];
    const newTemplate = replacePresetPlaceholders(template, project);
    createSurvey(newTemplate);
  };

  const XMTemplateOptions = [
    {
      title: t("environments.xm-templates.nps"),
      description: t("environments.xm-templates.nps_description"),
      icon: ShoppingCartIcon,
      onClick: () => handleTemplateClick(0),
      isLoading: activeTemplateId === 0,
    },
    {
      title: t("environments.xm-templates.five_star_rating"),
      description: t("environments.xm-templates.five_star_rating_description"),
      icon: StarIcon,
      onClick: () => handleTemplateClick(1),
      isLoading: activeTemplateId === 1,
    },
    {
      title: t("environments.xm-templates.csat"),
      description: t("environments.xm-templates.csat_description"),
      icon: ThumbsUpIcon,
      onClick: () => handleTemplateClick(2),
      isLoading: activeTemplateId === 2,
    },
    {
      title: t("environments.xm-templates.ces"),
      description: t("environments.xm-templates.ces_description"),
      icon: ActivityIcon,
      onClick: () => handleTemplateClick(3),
      isLoading: activeTemplateId === 3,
    },
    {
      title: t("environments.xm-templates.smileys"),
      description: t("environments.xm-templates.smileys_description"),
      icon: SmileIcon,
      onClick: () => handleTemplateClick(4),
      isLoading: activeTemplateId === 4,
    },
    {
      title: t("environments.xm-templates.enps"),
      description: t("environments.xm-templates.enps_description"),
      icon: UsersIcon,
      onClick: () => handleTemplateClick(5),
      isLoading: activeTemplateId === 5,
    },
  ];

  return <OnboardingOptionsContainer options={XMTemplateOptions} />;
};
