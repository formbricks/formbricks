"use client";

import { useResponseFilter } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import {
  getResponseCountAction,
  revalidateSurveyIdPath,
} from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/actions";
import { getFormattedFilters } from "@/app/lib/surveys/surveys";
import { getResponseCountBySurveySharingKeyAction } from "@/app/share/[sharingKey]/actions";
import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";
import { useTranslate } from "@tolgee/react";
import { InboxIcon, PresentationIcon } from "lucide-react";
import { useParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TSurvey } from "@formbricks/types/surveys/types";

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
  const { t } = useTranslate();
  const params = useParams();
  const [filteredResponseCount, setFilteredResponseCount] = useState<number | null>(null);
  const sharingKey = params.sharingKey as string;
  const isSharingPage = !!sharingKey;

  const url = isSharingPage ? `/share/${sharingKey}` : `/environments/${environmentId}/surveys/${survey.id}`;
  const { selectedFilter, dateRange } = useResponseFilter();

  const filters = useMemo(
    () => getFormattedFilters(survey, selectedFilter, dateRange),
    [selectedFilter, dateRange, survey]
  );

  const latestFiltersRef = useRef(filters);
  latestFiltersRef.current = filters;

  const getFilteredResponseCount = useCallback(() => {
    if (isSharingPage)
      return getResponseCountBySurveySharingKeyAction({
        sharingKey,
        filterCriteria: latestFiltersRef.current,
      });
    return getResponseCountAction({ surveyId: survey.id, filterCriteria: latestFiltersRef.current });
  }, [isSharingPage, sharingKey, survey.id]);

  const fetchFilteredResponseCount = useCallback(async () => {
    const count = await getFilteredResponseCount();
    const responseCount = count?.data ?? 0;
    setFilteredResponseCount(responseCount);
  }, [getFilteredResponseCount]);

  useEffect(() => {
    fetchFilteredResponseCount();
  }, [filters, isSharingPage, sharingKey, survey.id, fetchFilteredResponseCount]);

  const getResponseCountString = () => {
    if (initialTotalResponseCount === null) return "";
    if (filteredResponseCount === null) return `(${initialTotalResponseCount})`;

    const totalCount = Math.max(initialTotalResponseCount, filteredResponseCount);

    if (totalCount === filteredResponseCount) return `(${totalCount})`;

    return `(${filteredResponseCount} of ${totalCount})`;
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
