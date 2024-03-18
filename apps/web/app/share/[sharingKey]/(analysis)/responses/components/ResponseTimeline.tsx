"use client";

import EmptyInAppSurveys from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/EmptyInAppSurveys";
import { useEffect, useRef } from "react";

import { useMembershipRole } from "@formbricks/lib/membership/hooks/useMembershipRole";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { TEnvironment } from "@formbricks/types/environment";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys";
import { TTag } from "@formbricks/types/tags";
import EmptySpaceFiller from "@formbricks/ui/EmptySpaceFiller";
import SingleResponseCard from "@formbricks/ui/SingleResponseCard";

interface ResponseTimelineProps {
  environment: TEnvironment;
  surveyId: string;
  responses: TResponse[];
  survey: TSurvey;
  environmentTags: TTag[];
  fetchNextPage: () => void;
  hasMore: boolean;
}

export default function ResponseTimeline({
  environment,
  responses,
  survey,
  environmentTags,
  fetchNextPage,
  hasMore,
}: ResponseTimelineProps) {
  const loadingRef = useRef(null);

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

  const { membershipRole } = useMembershipRole(survey.environmentId);
  const { isViewer } = getAccessFlags(membershipRole);

  return (
    <div className="space-y-4">
      {survey.type === "web" && responses.length === 0 && !environment.widgetSetupCompleted ? (
        <EmptyInAppSurveys environment={environment} />
      ) : responses.length === 0 ? (
        <EmptySpaceFiller
          type="response"
          environment={environment}
          noWidgetRequired={survey.type === "link"}
        />
      ) : (
        <div>
          {responses.map((response) => {
            return (
              <div key={response.id}>
                <SingleResponseCard
                  survey={survey}
                  response={response}
                  user={undefined}
                  environmentTags={environmentTags}
                  pageType="response"
                  environment={environment}
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
}
