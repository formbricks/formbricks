"use client";

import { useResponseFilter } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import {
  getResponseCountAction,
  revalidateSurveyIdPath,
} from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/actions";
import { getFormattedFilters } from "@/app/lib/surveys/surveys";
import { getResponseCountBySurveySharingKeyAction } from "@/app/share/[sharingKey]/actions";
import { InboxIcon, PresentationIcon } from "lucide-react";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { TSurvey } from "@formbricks/types/surveys/types";
import { SecondaryNavigation } from "@formbricks/ui/SecondaryNavigation";

interface SurveyAnalysisNavigationProps {
  environmentId: string;
  survey: TSurvey;
  initialTotalResponseCount: number | null;
  activeId: string;
}

export const SurveyAnalysisNavigation = ({
  environmentId,
  survey,
  initialTotalResponseCount,
  activeId,
}: SurveyAnalysisNavigationProps) => {
  const pathname = usePathname();
  const params = useParams();
  const [filteredResponseCount, setFilteredResponseCount] = useState<number | null>(null);
  const [totalResponseCount, setTotalResponseCount] = useState<number | null>(initialTotalResponseCount);
  const sharingKey = params.sharingKey as string;
  const isSharingPage = !!sharingKey;

  const searchParams = useSearchParams();
  const isShareEmbedModalOpen = searchParams.get("share") === "true";

  const url = isSharingPage ? `/share/${sharingKey}` : `/environments/${environmentId}/surveys/${survey.id}`;
  const { selectedFilter, dateRange } = useResponseFilter();

  const filters = useMemo(
    () => getFormattedFilters(survey, selectedFilter, dateRange),
    [selectedFilter, dateRange]
  );

  const latestFiltersRef = useRef(filters);
  latestFiltersRef.current = filters;

  const getResponseCount = () => {
    if (isSharingPage) return getResponseCountBySurveySharingKeyAction({ sharingKey });
    return getResponseCountAction({ surveyId: survey.id });
  };

  const fetchResponseCount = async () => {
    const count = await getResponseCount();
    const responseCount = count?.data ?? 0;
    setTotalResponseCount(responseCount);
  };

  const getFilteredResponseCount = () => {
    if (isSharingPage)
      return getResponseCountBySurveySharingKeyAction({
        sharingKey,
        filterCriteria: latestFiltersRef.current,
      });
    return getResponseCountAction({ surveyId: survey.id, filterCriteria: latestFiltersRef.current });
  };

  const fetchFilteredResponseCount = async () => {
    const count = await getFilteredResponseCount();
    const responseCount = count?.data ?? 0;
    setFilteredResponseCount(responseCount);
  };

  useEffect(() => {
    fetchFilteredResponseCount();
  }, [filters, isSharingPage, sharingKey, survey.id]);

  useEffect(() => {
    if (!isShareEmbedModalOpen) {
      const interval = setInterval(() => {
        fetchResponseCount();
        fetchFilteredResponseCount();
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [isShareEmbedModalOpen]);

  const getResponseCountString = () => {
    if (totalResponseCount === null) return "";
    if (filteredResponseCount === null) return `(${totalResponseCount})`;

    if (totalResponseCount === filteredResponseCount) return `(${totalResponseCount})`;

    return `(${filteredResponseCount} of ${totalResponseCount})`;
  };

  const navigation = [
    {
      id: "summary",
      label: "Summary",
      icon: <PresentationIcon className="h-5 w-5" />,
      href: `${url}/summary?referer=true`,
      current: pathname?.includes("/summary"),
      onClick: () => {
        revalidateSurveyIdPath(environmentId, survey.id);
      },
    },
    {
      id: "responses",
      label: `Responses ${getResponseCountString()}`,
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
