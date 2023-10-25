"use client";

import { useResponseFilter } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
// import SurveyResultsTabs from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/SurveyResultsTabs";
import SummaryList from "./SummaryList";
import SummaryMetadata from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryMetadata";
// import CustomFilter from "@/app/(app)/share/[sharingKey]/components/CustomFilter";
import SummaryHeader from "../../../components/SummaryHeader";
import { getFilterResponses } from "@/app/lib/surveys/surveys";
import { useEffect, useMemo, useState } from "react";
import SummaryDropOffs from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryDropOffs";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys";
import ContentWrapper from "@formbricks/ui/ContentWrapper";
import { useSearchParams } from "next/navigation";

interface SummaryPageProps {
  survey: TSurvey;
  surveyId: string;
  responses: TResponse[];
  surveyBaseUrl: string;
  displayCount: number;
  openTextResponsesPerPage: number;
}

const SummaryPage = ({
  survey,
  surveyId,
  responses,
  surveyBaseUrl,
  displayCount,
  openTextResponsesPerPage,
}: SummaryPageProps) => {
  // const { selectedFilter, dateRange, resetState } = useResponseFilter();
  const [showDropOffs, setShowDropOffs] = useState<boolean>(false);
  // const searchParams = useSearchParams();

  // useEffect(() => {
  //   if (!searchParams?.get("referer")) {
  //     resetState();
  //   }
  // }, [searchParams]);

  // get the filtered array when the selected filter value changes
  // const filterResponses: TResponse[] = useMemo(() => {
  //   return getFilterResponses(responses, selectedFilter, survey, dateRange);
  // }, [selectedFilter, responses, survey, dateRange]);

  return (
    <ContentWrapper>
      <SummaryHeader survey={survey} surveyId={surveyId} surveyBaseUrl={surveyBaseUrl} />
      {/* <CustomFilter
        responses={filterResponses}
        survey={survey}
        totalResponses={responses}
      /> */}
      {/* <SurveyResultsTabs activeId="summary" environmentId={environment.id} surveyId={surveyId} /> */}
      <SummaryMetadata
        responses={responses}
        survey={survey}
        displayCount={displayCount}
        showDropOffs={showDropOffs}
        setShowDropOffs={setShowDropOffs}
      />
      {showDropOffs && <SummaryDropOffs survey={survey} responses={responses} displayCount={displayCount} />}
      <SummaryList
        responses={responses}
        survey={survey}
        openTextResponsesPerPage={openTextResponsesPerPage}
      />
    </ContentWrapper>
  );
};

export default SummaryPage;
