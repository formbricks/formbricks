"use client";

import { InboxIcon, PresentationIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { TSurvey } from "@formbricks/types/surveys/types";
import { useWorkspace } from "@/app/(app)/workspaces/[workspaceId]/context/environment-context";
import { revalidateSurveyIdPath } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/actions";
import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";

interface SurveyAnalysisNavigationProps {
  survey: TSurvey;
  activeId: string;
}

export const SurveyAnalysisNavigation = ({ survey, activeId }: SurveyAnalysisNavigationProps) => {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { workspace } = useWorkspace();

  const url = `/workspaces/${workspace?.id}/surveys/${survey.id}`;

  const navigation = [
    {
      id: "summary",
      label: t("common.summary"),
      icon: <PresentationIcon className="h-5 w-5" />,
      href: `${url}/summary?referer=true`,
      current: pathname?.includes("/summary"),
      onClick: () => {
        revalidateSurveyIdPath(workspace?.id ?? "", survey.id);
      },
    },
    {
      id: "responses",
      label: t("common.responses"),
      icon: <InboxIcon className="h-5 w-5" />,
      href: `${url}/responses?referer=true`,
      current: pathname?.includes("/responses"),
      onClick: () => {
        revalidateSurveyIdPath(workspace?.id ?? "", survey.id);
      },
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} />;
};
