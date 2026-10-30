"use client";

import { InboxIcon, PresentationIcon } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { TSurvey } from "@formbricks/types/surveys/types";
import { useWorkspace } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
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
  // Summary and Responses share one filter, kept in the URL: switching tabs carries it along.
  const searchParams = useSearchParams();
  const filterParams = new URLSearchParams(
    [...searchParams.entries()].filter(([key]) => key.startsWith("filter["))
  ).toString();
  const query = filterParams ? `?${filterParams}` : "";

  const navigation = [
    {
      id: "summary",
      label: t("common.summary"),
      icon: <PresentationIcon className="size-5" />,
      href: `${url}/summary${query}`,
      current: pathname?.includes("/summary"),
    },
    {
      id: "responses",
      label: t("common.responses"),
      icon: <InboxIcon className="size-5" />,
      href: `${url}/responses${query}`,
      current: pathname?.includes("/responses"),
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} />;
};
