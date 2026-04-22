"use client";

import { InboxIcon, PresentationIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useEnvironment } from "@/app/(app)/environments/[environmentId]/context/environment-context";
import { revalidateSurveyIdPath } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/actions";
import { useSurvey } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/context/survey-context";
import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";

interface SurveyAnalysisNavigationProps {
  activeId: string;
}

export const SurveyAnalysisNavigation = ({ activeId }: SurveyAnalysisNavigationProps) => {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { environment } = useEnvironment();
  const { survey } = useSurvey();

  const url = `/environments/${environment.id}/surveys/${survey.id}`;

  const navigation = [
    {
      id: "summary",
      label: t("common.summary"),
      icon: <PresentationIcon className="h-5 w-5" />,
      href: `${url}/summary?referer=true`,
      current: pathname?.includes("/summary"),
      onClick: () => {
        revalidateSurveyIdPath(environment.id, survey.id);
      },
    },
    {
      id: "responses",
      label: t("common.responses"),
      icon: <InboxIcon className="h-5 w-5" />,
      href: `${url}/responses?referer=true`,
      current: pathname?.includes("/responses"),
      onClick: () => {
        revalidateSurveyIdPath(environment.id, survey.id);
      },
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} />;
};
