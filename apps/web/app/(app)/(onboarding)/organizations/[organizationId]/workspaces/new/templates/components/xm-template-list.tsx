"use client";

import { ActivityIcon, ShoppingCartIcon, SmileIcon, StarIcon, ThumbsUpIcon, UsersIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TSurveyCreateInput } from "@formbricks/types/surveys/types";
import { TTemplate } from "@formbricks/types/templates";
import { TUser } from "@formbricks/types/user";
import { TWorkspace } from "@formbricks/types/workspace";
import {
  TOnboardingXMTemplateId,
  XM_TEMPLATE_IDS,
} from "@/app/(app)/(onboarding)/organizations/[organizationId]/workspaces/new/templates/lib/xm-template-ids";
import { OnboardingOptionsContainer } from "@/app/(app)/(onboarding)/organizations/components/OnboardingOptionsContainer";
import { templates } from "@/app/lib/templates";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { replacePresetPlaceholders } from "@/lib/utils/templates";
import { createSurveyAction } from "@/modules/survey/components/template-list/actions";

interface XMTemplateListProps {
  workspace: TWorkspace;
  user: TUser;
  workspaceId: string;
}

export const XMTemplateList = ({ workspace, user, workspaceId }: Readonly<XMTemplateListProps>) => {
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const { t } = useTranslation();
  const router = useRouter();

  const createSurvey = async (activeTemplate: TTemplate) => {
    const augmentedTemplate: TSurveyCreateInput = {
      ...activeTemplate.preset,
      type: "link",
      createdBy: user.id,
    };
    const createSurveyResponse = await createSurveyAction({
      workspaceId: workspaceId,
      surveyBody: augmentedTemplate,
      createdFrom: "template",
    });

    if (createSurveyResponse?.data) {
      router.push(`/workspaces/${workspaceId}/surveys/${createSurveyResponse.data.id}/edit?mode=cx`);
    } else {
      const errorMessage = getFormattedErrorMessage(createSurveyResponse);
      toast.error(errorMessage);
    }
  };

  const handleTemplateClick = (templateId: TOnboardingXMTemplateId) => {
    setActiveTemplateId(templateId);
    const template = templates(t).find((template) => template.id === templateId);
    if (!template) {
      toast.error(t("common.something_went_wrong_please_try_again"));
      setActiveTemplateId(null);
      return;
    }
    const newTemplate = replacePresetPlaceholders(template, workspace);
    void createSurvey(newTemplate);
  };

  const XMTemplateOptions = [
    {
      title: t("workspace.xm-templates.nps"),
      description: t("workspace.xm-templates.nps_description"),
      icon: ShoppingCartIcon,
      onClick: () => handleTemplateClick(XM_TEMPLATE_IDS[0]),
      isLoading: activeTemplateId === XM_TEMPLATE_IDS[0],
    },
    {
      title: t("workspace.xm-templates.five_star_rating"),
      description: t("workspace.xm-templates.five_star_rating_description"),
      icon: StarIcon,
      onClick: () => handleTemplateClick(XM_TEMPLATE_IDS[1]),
      isLoading: activeTemplateId === XM_TEMPLATE_IDS[1],
    },
    {
      title: t("workspace.xm-templates.csat"),
      description: t("workspace.xm-templates.csat_description"),
      icon: ThumbsUpIcon,
      onClick: () => handleTemplateClick(XM_TEMPLATE_IDS[2]),
      isLoading: activeTemplateId === XM_TEMPLATE_IDS[2],
    },
    {
      title: t("workspace.xm-templates.ces"),
      description: t("workspace.xm-templates.ces_description"),
      icon: ActivityIcon,
      onClick: () => handleTemplateClick(XM_TEMPLATE_IDS[3]),
      isLoading: activeTemplateId === XM_TEMPLATE_IDS[3],
    },
    {
      title: t("workspace.xm-templates.smileys"),
      description: t("workspace.xm-templates.smileys_description"),
      icon: SmileIcon,
      onClick: () => handleTemplateClick(XM_TEMPLATE_IDS[4]),
      isLoading: activeTemplateId === XM_TEMPLATE_IDS[4],
    },
    {
      title: t("workspace.xm-templates.enps"),
      description: t("workspace.xm-templates.enps_description"),
      icon: UsersIcon,
      onClick: () => handleTemplateClick(XM_TEMPLATE_IDS[5]),
      isLoading: activeTemplateId === XM_TEMPLATE_IDS[5],
    },
  ];

  return <OnboardingOptionsContainer options={XMTemplateOptions} />;
};
