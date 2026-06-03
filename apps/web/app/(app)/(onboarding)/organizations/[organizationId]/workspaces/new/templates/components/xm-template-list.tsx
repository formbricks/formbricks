"use client";

import { ActivityIcon, ShoppingCartIcon, SmileIcon, StarIcon, ThumbsUpIcon, UsersIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TUserLocale } from "@formbricks/types/user";
import {
  TOnboardingXMTemplateId,
  XM_TEMPLATE_IDS,
} from "@/app/(app)/(onboarding)/organizations/[organizationId]/workspaces/new/templates/lib/xm-template-ids";
import { OnboardingOptionsContainer } from "@/app/(app)/(onboarding)/organizations/components/OnboardingOptionsContainer";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { createSurveyFromTemplate } from "@/modules/survey/components/template-list/lib/v3-template-client";

interface XMTemplateListProps {
  workspaceId: string;
  defaultLanguage: TUserLocale;
}

export const XMTemplateList = ({ workspaceId, defaultLanguage }: Readonly<XMTemplateListProps>) => {
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const { t } = useTranslation();
  const router = useRouter();

  const createSurvey = async (templateId: string) => {
    try {
      const survey = await createSurveyFromTemplate({
        workspaceId,
        templateId,
        source: "xm",
        surveyType: "link",
        defaultLanguage,
      });

      router.push(`/workspaces/${workspaceId}/surveys/${survey.id}/edit?mode=cx`);
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")));
    } finally {
      setActiveTemplateId(null);
    }
  };

  const handleTemplateClick = (templateId: TOnboardingXMTemplateId) => {
    setActiveTemplateId(templateId);
    void createSurvey(templateId);
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
