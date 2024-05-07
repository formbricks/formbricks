"use client";

import revalidateSurveyIdPath from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/actions";
import { InboxIcon, PresentationIcon } from "lucide-react";
import { useParams, usePathname } from "next/navigation";

import { SecondNavigation } from "@formbricks/ui/SecondNavigation";

interface SurveyInsightsTabsProps {
  environmentId: string;
  surveyId: string;
  responseCount: number | null;
}

export const SurveyInsightsTabs = ({ environmentId, surveyId, responseCount }: SurveyInsightsTabsProps) => {
  const pathname = usePathname();
  const params = useParams();
  const sharingKey = params.sharingKey as string;
  const isSharingPage = !!sharingKey;

  const url = isSharingPage ? `/share/${sharingKey}` : `/environments/${environmentId}/surveys/${surveyId}`;

  const navigation = [
    {
      id: "summary",
      label: "Summary",
      icon: <PresentationIcon className="h-5 w-5" />,
      href: `${url}/summary?referer=true`,
      current: pathname?.includes("/summary"),
      onClick: () => {
        revalidateSurveyIdPath(environmentId, surveyId);
      },
    },
    {
      id: "responses",
      label: `Responses ${responseCount !== null ? `(${responseCount})` : ""}`,
      icon: <InboxIcon className="h-5 w-5" />,
      href: `${url}/responses?referer=true`,
      current: pathname?.includes("/responses"),
      onClick: () => {
        revalidateSurveyIdPath(environmentId, surveyId);
      },
    },
  ];

  return <SecondNavigation navigation={navigation} />;
};
