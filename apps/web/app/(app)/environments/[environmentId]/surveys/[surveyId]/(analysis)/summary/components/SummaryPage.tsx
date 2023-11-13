"use client";

import { useResponseFilter } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import SurveyResultsTabs from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/SurveyResultsTabs";
import SummaryList from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryList";
import SummaryMetadata from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryMetadata";
import CustomFilter from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/CustomFilter";
import SummaryHeader from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/SummaryHeader";
import { getFilterResponses } from "@/app/lib/surveys/surveys";
import { useEffect, useMemo, useState } from "react";
import SummaryDropOffs from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryDropOffs";
import { TEnvironment } from "@formbricks/types/environment";
import { TProduct } from "@formbricks/types/product";
import { TProfile } from "@formbricks/types/profile";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys";
import { TTag } from "@formbricks/types/tags";
import ContentWrapper from "@formbricks/ui/ContentWrapper";
import { useSearchParams } from "next/navigation";
import { TMembershipRole } from "@formbricks/types/memberships";

interface SummaryPageProps {
  environment: TEnvironment;
  survey: TSurvey;
  surveyId: string;
  responses: TResponse[];
  webAppUrl: string;
  product: TProduct;
  profile: TProfile;
  environmentTags: TTag[];
  displayCount: number;
  responsesPerPage: number;
  membershipRole?: TMembershipRole;
}

const SummaryPage = ({
  environment,
  survey,
  surveyId,
  responses,
  webAppUrl,
  product,
  profile,
  environmentTags,
  displayCount,
  responsesPerPage,
  membershipRole,
}: SummaryPageProps) => {
  const { selectedFilter, dateRange, resetState } = useResponseFilter();
  const [showDropOffs, setShowDropOffs] = useState<boolean>(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!searchParams?.get("referer")) {
      resetState();
    }
  }, [searchParams]);

  // get the filtered array when the selected filter value changes
  const filterResponses: TResponse[] = useMemo(() => {
    return getFilterResponses(responses, selectedFilter, survey, dateRange);
  }, [selectedFilter, responses, survey, dateRange]);

  return (
    <ContentWrapper>
      <SummaryHeader
        environment={environment}
        survey={survey}
        surveyId={surveyId}
        webAppUrl={webAppUrl}
        product={product}
        profile={profile}
        membershipRole={membershipRole}
      />
      <CustomFilter
        environmentTags={environmentTags}
        responses={filterResponses}
        survey={survey}
        totalResponses={responses}
      />
      <SurveyResultsTabs activeId="summary" environmentId={environment.id} surveyId={surveyId} />
      <SummaryMetadata
        responses={filterResponses}
        survey={survey}
        displayCount={displayCount}
        showDropOffs={showDropOffs}
        setShowDropOffs={setShowDropOffs}
      />
      {showDropOffs && <SummaryDropOffs survey={survey} responses={responses} displayCount={displayCount} />}
      <SummaryList
        responses={filterResponses}
        survey={survey}
        environment={environment}
        responsesPerPage={responsesPerPage}
      />
    </ContentWrapper>
  );
};

export default SummaryPage;
