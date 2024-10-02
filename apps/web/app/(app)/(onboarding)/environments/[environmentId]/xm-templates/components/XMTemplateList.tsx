"use client";

import { replacePresetPlaceholders } from "@/app/(app)/(onboarding)/environments/[environmentId]/xm-templates/lib/utils";
import { XMTemplates } from "@/app/(app)/(onboarding)/environments/[environmentId]/xm-templates/lib/xm-templates";
import { OnboardingOptionsContainer } from "@/app/(app)/(onboarding)/organizations/components/OnboardingOptionsContainer";
import { ActivityIcon, ShoppingCartIcon, SmileIcon, StarIcon, ThumbsUpIcon, UsersIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { getFormattedErrorMessage } from "@formbricks/lib/actionClient/helper";
import { TProduct } from "@formbricks/types/product";
import { TSurveyCreateInput } from "@formbricks/types/surveys/types";
import { TXMTemplate } from "@formbricks/types/templates";
import { TUser } from "@formbricks/types/user";
import { createSurveyAction } from "@formbricks/ui/components/TemplateList/actions";

interface XMTemplateListProps {
  product: TProduct;
  user: TUser;
  environmentId: string;
}

export const XMTemplateList = ({ product, user, environmentId }: XMTemplateListProps) => {
  const [activeTemplateId, setActiveTemplateId] = useState<number | null>(null);

  const router = useRouter();

  const createSurvey = async (activeTemplate: TXMTemplate) => {
    const augmentedTemplate: TSurveyCreateInput = {
      ...activeTemplate,
      type: "link",
      createdBy: user.id,
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

  const handleTemplateClick = (templateIdx) => {
    setActiveTemplateId(templateIdx);
    const template = XMTemplates[templateIdx];
    const newTemplate = replacePresetPlaceholders(template, product);
    createSurvey(newTemplate);
  };

  const XMTemplateOptions = [
    {
      title: "NPS",
      description: "Implement proven best practices to understand WHY people buy.",
      icon: ShoppingCartIcon,
      onClick: () => handleTemplateClick(0),
      isLoading: activeTemplateId === 0,
    },
    {
      title: "5-Star Rating",
      description: "Universal feedback solution to gauge overall satisfaction.",
      icon: StarIcon,
      onClick: () => handleTemplateClick(1),
      isLoading: activeTemplateId === 1,
    },
    {
      title: "CSAT",
      description: "Implement best practices to measure customer satisfaction.",
      icon: ThumbsUpIcon,
      onClick: () => handleTemplateClick(2),
      isLoading: activeTemplateId === 2,
    },
    {
      title: "CES",
      description: "Leverage every touchpoint to understand ease of customer interaction.",
      icon: ActivityIcon,
      onClick: () => handleTemplateClick(3),
      isLoading: activeTemplateId === 3,
    },
    {
      title: "Smileys",
      description: "Use visual indicators to capture feedback across customer touchpoints.",
      icon: SmileIcon,
      onClick: () => handleTemplateClick(4),
      isLoading: activeTemplateId === 4,
    },
    {
      title: "eNPS",
      description: "Universal feedback to understand employee engagement and satisfaction.",
      icon: UsersIcon,
      onClick: () => handleTemplateClick(5),
      isLoading: activeTemplateId === 5,
    },
  ];

  return <OnboardingOptionsContainer options={XMTemplateOptions} />;
};
