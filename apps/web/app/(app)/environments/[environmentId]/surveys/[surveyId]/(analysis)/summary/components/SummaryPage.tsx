"use client";

import { useResponseFilter } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import {
  getResponseCountAction,
  getSurveySummaryAction,
} from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/actions";
import { SummaryDropOffs } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryDropOffs";
import { CustomFilter } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/CustomFilter";
import { ResultsShareButton } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/ResultsShareButton";
import { getFormattedFilters } from "@/app/lib/surveys/surveys";
import {
  getResponseCountBySurveySharingKeyAction,
  getSummaryBySurveySharingKeyAction,
} from "@/app/share/[sharingKey]/actions";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useIntervalWhenFocused } from "@formbricks/lib/utils/hooks/useIntervalWhenFocused";
import { replaceHeadlineRecall } from "@formbricks/lib/utils/recall";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey, TSurveySummary } from "@formbricks/types/surveys/types";
import { TUser } from "@formbricks/types/user";
import { SummaryList } from "./SummaryList";
import { SummaryMetadata } from "./SummaryMetadata";
import { ArrowUp,AlignJustify,X} from "lucide-react";

const initialSurveySummary: TSurveySummary = {
  meta: {
    completedPercentage: 0,
    completedResponses: 0,
    displayCount: 0,
    dropOffPercentage: 0,
    dropOffCount: 0,
    startsPercentage: 0,
    totalResponses: 0,
    ttcAverage: 0,
  },
  dropOff: [],
  summary: [],
};

interface SummaryPageProps {
  environment: TEnvironment;
  survey: TSurvey;
  surveyId: string;
  webAppUrl: string;
  user?: TUser;
  totalResponseCount: number;
  attributeClasses: TAttributeClass[];
}

export const SummaryPage = ({
  environment,
  survey,
  surveyId,
  webAppUrl,
  totalResponseCount,
  attributeClasses,
}: SummaryPageProps) => {
  const params = useParams();
  const sharingKey = params.sharingKey as string;
  const isSharingPage = !!sharingKey;

  const searchParams = useSearchParams();
  const isShareEmbedModalOpen = searchParams.get("share") === "true";

  const [responseCount, setResponseCount] = useState<number | null>(null);
  const [surveySummary, setSurveySummary] = useState<TSurveySummary>(initialSurveySummary);
  const [showDropOffs, setShowDropOffs] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [openFilter,setOpenFilter]=useState(false);
  const [openTopButton, setOpenTopButton] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const startref = useRef<HTMLDivElement>(null);
  

  const { selectedFilter, dateRange, resetState } = useResponseFilter();

  const filters = useMemo(
    () => getFormattedFilters(survey, selectedFilter, dateRange),
    [selectedFilter, dateRange]
  );

  // Use a ref to keep the latest state and props
  const latestFiltersRef = useRef(filters);
  latestFiltersRef.current = filters;

  const getResponseCount = () => {
    if (isSharingPage)
      return getResponseCountBySurveySharingKeyAction({
        sharingKey,
        filterCriteria: latestFiltersRef.current,
      });
    return getResponseCountAction({
      surveyId,
      filterCriteria: latestFiltersRef.current,
    });
  };

  


  const getSummary = () => {
    if (isSharingPage)
      return getSummaryBySurveySharingKeyAction({
        sharingKey,
        filterCriteria: latestFiltersRef.current,
      });

    return getSurveySummaryAction({
      surveyId,
      filterCriteria: latestFiltersRef.current,
    });
  };

  const handleInitialData = async (isInitialLoad = false) => {
    if (isInitialLoad) {
      setIsLoading(true);
    }

    try {
      const [updatedResponseCountData, updatedSurveySummary] = await Promise.all([
        getResponseCount(),
        getSummary(),
      ]);

      const responseCount = updatedResponseCountData?.data ?? 0;
      const surveySummary = updatedSurveySummary?.data ?? initialSurveySummary;

      // Update the state with new data
      setResponseCount(responseCount);
      setSurveySummary(surveySummary);
    } catch (error) {
      console.error(error);
    } finally {
      if (isInitialLoad) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    handleInitialData(true);
  }, [JSON.stringify(filters), isSharingPage, sharingKey, surveyId]);

  useIntervalWhenFocused(
    () => {
      handleInitialData(false);
    },
    10000,
    !isShareEmbedModalOpen,
    false
  );

  const surveyMemoized = useMemo(() => {
    return replaceHeadlineRecall(survey, "default", attributeClasses);
  }, [survey, attributeClasses]);

  useEffect(() => {
    if (!searchParams?.get("referer")) {
      resetState();
    }
  }, [searchParams, resetState]);


  useEffect(() => {
    
    const handleScroll = () => {
     
      if (endRef.current) {
         const scrollTop = endRef.current.scrollTop;
        if (scrollTop > 170) {
          
          setOpenTopButton(true);
        } else {
          setOpenTopButton(false);
        }
      }
    };

    const container = endRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
    }
    return () => {
      if (container) {
        container.removeEventListener("scroll", handleScroll);
      }
    };
  }, []);

  return (
    <>
    <div className="  space-y-6 h-[500px]  overflow-y-scroll no-scrollbar"  ref={endRef}  >
    <div    ref={startref}></div>
      <SummaryMetadata
        surveySummary={surveySummary.meta}
        showDropOffs={showDropOffs}
        setShowDropOffs={setShowDropOffs}
        isLoading={isLoading}
      />
      {showDropOffs && <SummaryDropOffs dropOff={surveySummary.dropOff} />}
      
      <div className="flex gap-1.5">
        <CustomFilter survey={surveyMemoized} />
        {!isSharingPage && <ResultsShareButton survey={surveyMemoized} webAppUrl={webAppUrl} />}
      </div>
      <SummaryList
        summary={surveySummary.summary}
        responseCount={responseCount}
        survey={surveyMemoized}
        environment={environment}
        totalResponseCount={totalResponseCount}
        attributeClasses={attributeClasses}
      />
     
  
      {openTopButton &&  <div className={openFilter ? "absolute bottom-2 left-1/3 gap-15 flex items-center justify-between ": "absolute bottom-2 left-1/2 w-fit flex items-center justify-center"} >
        {openFilter &&  <div className="flex gap-1.5">
          <CustomFilter survey={surveyMemoized} />
          {!isSharingPage && <ResultsShareButton survey={surveyMemoized} webAppUrl={webAppUrl} />}
        </div>}
        <div className="rounded-lg border border-slate-200 bg-white p-3 flex   items-center">
          <div className="flex   items-center overflow-hidden">
            <div onClick={() => setOpenFilter((prev) => !prev)} className=" cursor-pointer flex w-10 items-center justify-center ">
          { openFilter ? <X className="h-6 w-6"/> : <AlignJustify className="h-6 w-6"/>}
            </div>
            
            <div onClick = {() => {startref.current?.scrollIntoView({ behavior: "smooth" })}} className="rounded-s border cursor-pointer bg-brand-dark flex w-10 items-center justify-center   ">
          
            <ArrowUp className="h-6 w-6 text-white"/>
            </div>
          </div>
        </div>

        </div>}
      </div>
    </>
  );
};
