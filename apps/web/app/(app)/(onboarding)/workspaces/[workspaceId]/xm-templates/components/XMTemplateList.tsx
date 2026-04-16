"use client";

import { ActivityIcon, ShoppingCartIcon, SmileIcon, StarIcon, ThumbsUpIcon, UsersIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TSurveyCreateInput } from "@formbricks/types/surveys/types";
import { TXMTemplate } from "@formbricks/types/templates";
import { TUser } from "@formbricks/types/user";
import { TWorkspace } from "@formbricks/types/workspace";
import { OnboardingOptionsContainer } from "@/app/(app)/(onboarding)/organizations/components/OnboardingOptionsContainer";
import { replacePresetPlaceholders } from "@/app/(app)/(onboarding)/workspaces/[workspaceId]/xm-templates/lib/utils";
import { getXMTemplates } from "@/app/(app)/(onboarding)/workspaces/[workspaceId]/xm-templates/lib/xm-templates";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { createSurveyAction } from "@/modules/survey/components/template-list/actions";

interface XMTemplateListProps {
  workspace: TWorkspace;
  user: TUser;
  workspaceId: string;
}

export const XMTemplateList = ({ workspace, user, workspaceId }: XMTemplateListProps) => {
  const [activeTemplateId, setActiveTemplateId] = useState<number | null>(null);
  const { t } = useTranslation();
  const router = useRouter();

  const createSurvey = async (activeTemplate: TXMTemplate) => {
    const augmentedTemplate: TSurveyCreateInput = {
      ...activeTemplate,
      type: "link",
      createdBy: user.id,
    };
    const createSurveyResponse = await createSurveyAction({
      workspaceId: workspaceId,
      surveyBody: augmentedTemplate,
    });

    if (createSurveyResponse?.data) {
      router.push(`/workspaces/${workspaceId}/surveys/${createSurveyResponse.data.id}/edit?mode=cx`);
    } else {
      const errorMessage = getFormattedErrorMessage(createSurveyResponse);
      toast.error(errorMessage);
    }
  };

  const handleTemplateClick = (templateIdx: number) => {
    setActiveTemplateId(templateIdx);
    const template = getXMTemplates(t)[templateIdx];
    const newTemplate = replacePresetPlaceholders(template, workspace);
    createSurvey(newTemplate);
  };

  const XMTemplateOptions = [
    {
      title: t("workspace.xm-templates.nps"),
      description: t("workspace.xm-templates.nps_description"),
      icon: ShoppingCartIcon,
      onClick: () => handleTemplateClick(0),
      isLoading: activeTemplateId === 0,
    },
    {
      title: t("workspace.xm-templates.five_star_rating"),
      description: t("workspace.xm-templates.five_star_rating_description"),
      icon: StarIcon,
      onClick: () => handleTemplateClick(1),
      isLoading: activeTemplateId === 1,
    },
    {
      title: t("workspace.xm-templates.csat"),
      description: t("workspace.xm-templates.csat_description"),
      icon: ThumbsUpIcon,
      onClick: () => handleTemplateClick(2),
      isLoading: activeTemplateId === 2,
    },
    {
      title: t("workspace.xm-templates.ces"),
      description: t("workspace.xm-templates.ces_description"),
      icon: ActivityIcon,
      onClick: () => handleTemplateClick(3),
      isLoading: activeTemplateId === 3,
    },
    {
      title: t("workspace.xm-templates.smileys"),
      description: t("workspace.xm-templates.smileys_description"),
      icon: SmileIcon,
      onClick: () => handleTemplateClick(4),
      isLoading: activeTemplateId === 4,
    },
    {
      title: t("workspace.xm-templates.enps"),
      description: t("workspace.xm-templates.enps_description"),
      icon: UsersIcon,
      onClick: () => handleTemplateClick(5),
      isLoading: activeTemplateId === 5,
    },
  ];

  return <OnboardingOptionsContainer options={XMTemplateOptions} />;
};
