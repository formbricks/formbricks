"use client";

import { InboxIcon, PresentationIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { TSurvey } from "@formbricks/types/surveys/types";
import { revalidateSurveyIdPath } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/actions";
import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";

interface SurveyAnalysisNavigationProps {
  environmentId: string;
  survey: TSurvey;
  activeId: string;
}

export const SurveyAnalysisNavigation = ({
  environmentId,
  survey,
  activeId,
}: SurveyAnalysisNavigationProps) => {
  const pathname = usePathname();
  const { t } = useTranslation();

  const url = `/environments/${environmentId}/surveys/${survey.id}`;

  const navigation = [
    {
      id: "summary",
      label: t("common.summary"),
      icon: <PresentationIcon className="h-5 w-5" />,
      href: `${url}/summary?referer=true`,
      current: pathname?.includes("/summary"),
      onClick: () => {
        revalidateSurveyIdPath(environmentId, survey.id);
      },
    },
    {
      id: "responses",
      label: t("common.responses"),
      icon: <InboxIcon className="h-5 w-5" />,
      href: `${url}/responses?referer=true`,
      current: pathname?.includes("/responses"),
      onClick: () => {
        revalidateSurveyIdPath(environmentId, survey.id);
      },
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} />;
};
