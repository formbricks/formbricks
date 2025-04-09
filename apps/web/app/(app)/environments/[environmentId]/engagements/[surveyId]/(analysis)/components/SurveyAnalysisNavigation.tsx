"use client";

import { useResponseFilter } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import {
  getResponseCountAction,
  revalidateSurveyIdPath,
} from "@/app/(app)/environments/[environmentId]/engagements/[surveyId]/(analysis)/actions";
import { getFormattedFilters } from "@/app/lib/surveys/surveys";
import { getResponseCountBySurveySharingKeyAction } from "@/app/share/[sharingKey]/actions";
import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";
import { useTranslate } from "@tolgee/react";
import { InboxIcon, PresentationIcon } from "lucide-react";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntervalWhenFocused } from "@formbricks/lib/utils/hooks/useIntervalWhenFocused";
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
  const [totalResponseCount, setTotalResponseCount] = useState<number | null>(initialTotalResponseCount);
  const sharingKey = params.sharingKey as string;
  const isSharingPage = !!sharingKey;

  const searchParams = useSearchParams();
  const isShareEmbedModalOpen = searchParams.get("share") === "true";

  const url = isSharingPage
    ? `/share/${sharingKey}`
    : `/environments/${environmentId}/engagements/${survey.id}`;
  const { selectedFilter, dateRange } = useResponseFilter();

  const filters = useMemo(
    () => getFormattedFilters(survey, selectedFilter, dateRange),
    [selectedFilter, dateRange, survey]
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

  useIntervalWhenFocused(
    () => {
      fetchResponseCount();
      fetchFilteredResponseCount();
    },
    10000,
    !isShareEmbedModalOpen,
    false
  );

  const getResponseCountString = () => {
    if (totalResponseCount === null) return "";
    if (filteredResponseCount === null) return `(${totalResponseCount})`;

    const totalCount = Math.max(totalResponseCount, filteredResponseCount);

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
