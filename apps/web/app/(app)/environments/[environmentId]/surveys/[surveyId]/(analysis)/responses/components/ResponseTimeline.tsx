"use client";

import { EmptyAppSurveys } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/EmptyInAppSurveys";
import { useEffect, useRef, useState } from "react";
import { getMembershipByUserIdOrganizationIdAction } from "@formbricks/lib/membership/hooks/actions";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { TEnvironment } from "@formbricks/types/environment";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUser } from "@formbricks/types/user";
import { EmptySpaceFiller } from "@formbricks/ui/EmptySpaceFiller";
import { SingleResponseCard } from "@formbricks/ui/SingleResponseCard";
import { SkeletonLoader } from "@formbricks/ui/SkeletonLoader";

interface ResponseTimelineProps {
  environment: TEnvironment;
  surveyId: string;
  responses: TResponse[];
  survey: TSurvey;
  user?: TUser;
  environmentTags: TTag[];
  fetchNextPage: () => void;
  hasMore: boolean;
  updateResponse: (responseId: string, responses: TResponse) => void;
  deleteResponse: (responseId: string) => void;
  isFetchingFirstPage: boolean;
  responseCount: number | null;
  totalResponseCount: number;
  isSharingPage?: boolean;
}

export const ResponseTimeline = ({
  environment,
  responses,
  survey,
  user,
  environmentTags,
  fetchNextPage,
  hasMore,
  updateResponse,
  deleteResponse,
  isFetchingFirstPage,
  responseCount,
  totalResponseCount,
  isSharingPage = false,
}: ResponseTimelineProps) => {
  const [isViewer, setIsViewer] = useState(false);
  const loadingRef = useRef(null);

  const widgetSetupCompleted =
    survey.type === "app" ? environment.appSetupCompleted : environment.websiteSetupCompleted;

  useEffect(() => {
    const currentLoadingRef = loadingRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          if (hasMore) fetchNextPage();
        }
      },
      { threshold: 0.8 }
    );

    if (currentLoadingRef) {
      observer.observe(currentLoadingRef);
    }

    return () => {
      if (currentLoadingRef) {
        observer.unobserve(currentLoadingRef);
      }
    };
  }, [fetchNextPage, hasMore]);

  useEffect(() => {
    const getRole = async () => {
      if (isSharingPage) return setIsViewer(true);

      const membershipRole = await getMembershipByUserIdOrganizationIdAction(survey.environmentId);
      const { isViewer } = getAccessFlags(membershipRole);
      setIsViewer(isViewer);
    };
    getRole();
  }, [survey.environmentId, isSharingPage]);

  return (
    <div className="space-y-4">
      {(survey.type === "app" || survey.type === "website") &&
      responses.length === 0 &&
      !widgetSetupCompleted ? (
        <EmptyAppSurveys environment={environment} surveyType={survey.type} />
      ) : isFetchingFirstPage ? (
        <SkeletonLoader type="response" />
      ) : responseCount === 0 ? (
        <EmptySpaceFiller
          type="response"
          environment={environment}
          noWidgetRequired={survey.type === "link"}
          emptyMessage={totalResponseCount === 0 ? undefined : "No response matches your filter"}
          widgetSetupCompleted={widgetSetupCompleted}
        />
      ) : (
        <div>
          {responses.map((response) => {
            return (
              <div key={response.id}>
                <SingleResponseCard
                  survey={survey}
                  response={response}
                  user={user}
                  environmentTags={environmentTags}
                  pageType="response"
                  environment={environment}
                  updateResponse={updateResponse}
                  deleteResponse={deleteResponse}
                  isViewer={isViewer}
                />
              </div>
            );
          })}
          <div ref={loadingRef}></div>
        </div>
      )}
    </div>
  );
};
