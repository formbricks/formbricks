"use client";

import { revalidateSurveyIdPath } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/actions";
import { useResponseCountContext } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/ResponseCountProvider";
import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";
import { useTranslate } from "@tolgee/react";
import { InboxIcon, PresentationIcon } from "lucide-react";
import { useParams, usePathname } from "next/navigation";
import { useEffect } from "react";
import toast from "react-hot-toast";
import { TSurvey } from "@formbricks/types/surveys/types";

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
  const { t } = useTranslate();
  const params = useParams();
  const sharingKey = params.sharingKey as string;
  const isSharingPage = !!sharingKey;

  const url = isSharingPage ? `/share/${sharingKey}` : `/environments/${environmentId}/surveys/${survey.id}`;

  // Use the shared response count context with enterprise features
  const { responseCount, isLoading, error, refetch } = useResponseCountContext();

  // Show error toast
  useEffect(() => {
    if (error) {
      toast.error(`Failed to load response count: ${error}`, {
        duration: 5000,
      });
    }
  }, [error, refetch]);

  const getResponseCountString = () => {
    if (isLoading) return "(...)";
    if (error) return "(!)";
    if (responseCount === null) return "";
    return `(${responseCount})`;
  };

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
      label: `${t("common.responses")} ${getResponseCountString()}`,
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
