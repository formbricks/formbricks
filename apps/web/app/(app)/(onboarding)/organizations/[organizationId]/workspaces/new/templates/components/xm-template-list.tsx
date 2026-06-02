"use client";

import { ActivityIcon, ShoppingCartIcon, SmileIcon, StarIcon, ThumbsUpIcon, UsersIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import {
  TOnboardingXMTemplateId,
  XM_TEMPLATE_IDS,
} from "@/app/(app)/(onboarding)/organizations/[organizationId]/workspaces/new/templates/lib/xm-template-ids";
import { OnboardingOptionsContainer } from "@/app/(app)/(onboarding)/organizations/components/OnboardingOptionsContainer";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { createSurveyAction } from "@/modules/survey/components/template-list/actions";

interface XMTemplateListProps {
  workspaceId: string;
}

export const XMTemplateList = ({ workspaceId }: Readonly<XMTemplateListProps>) => {
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const { t } = useTranslation();
  const router = useRouter();

  const createSurvey = async (templateId: string) => {
    try {
      const createSurveyResponse = await createSurveyAction({
        workspaceId,
        templateId,
        surveyType: "link",
      });

      if (createSurveyResponse?.data) {
        router.push(`/workspaces/${workspaceId}/surveys/${createSurveyResponse.data.id}/edit?mode=cx`);
      } else {
        const errorMessage =
          getFormattedErrorMessage(createSurveyResponse ?? {}) ||
          t("common.something_went_wrong_please_try_again");
        toast.error(errorMessage);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error && error.message
          ? error.message
          : t("common.something_went_wrong_please_try_again");
      toast.error(errorMessage);
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
