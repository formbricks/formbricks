"use client";

import { getMoreResponses } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/actions";
import EmptyInAppSurveys from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/EmptyInAppSurveys";
import React, { useEffect, useRef, useState } from "react";

import { TEnvironment } from "@formbricks/types/environment";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys";
import { TTag } from "@formbricks/types/tags";
import { TUser } from "@formbricks/types/user";
import EmptySpaceFiller from "@formbricks/ui/EmptySpaceFiller";
import SingleResponseCard from "@formbricks/ui/SingleResponseCard";

interface ResponseTimelineProps {
  environment: TEnvironment;
  surveyId: string;
  responses: TResponse[];
  survey: TSurvey;
  user: TUser;
  environmentTags: TTag[];
  responsesPerPage: number;
}

export default function ResponseTimeline({
  environment,
  responses,
  survey,
  user,
  environmentTags,
  responsesPerPage,
}: ResponseTimelineProps) {
  const loadingRef = useRef(null);
  const [fetchedResponses, setFetchedResponses] = useState<TResponse[]>(responses);
  const [page, setPage] = useState(2);
  const [hasMoreResponses, setHasMoreResponses] = useState(true);

  useEffect(() => {
    const currentLoadingRef = loadingRef.current;

    const loadResponses = async () => {
      const newResponses = await getMoreResponses(survey.id, page);
      if (newResponses.length === 0) {
        setHasMoreResponses(false);
      } else {
        setPage(page + 1);
      }
      setFetchedResponses((prevResponses) => [...prevResponses, ...newResponses]);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          if (hasMoreResponses) loadResponses();
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
  }, [responses, responsesPerPage, page, survey.id, fetchedResponses.length, hasMoreResponses]);

  return (
    <div className="space-y-4">
      {survey.type === "web" && fetchedResponses.length === 0 && !environment.widgetSetupCompleted ? (
        <EmptyInAppSurveys environment={environment} />
      ) : fetchedResponses.length === 0 ? (
        <EmptySpaceFiller
          type="response"
          environment={environment}
          noWidgetRequired={survey.type === "link"}
        />
      ) : (
        <div>
          {fetchedResponses.map((response) => {
            return (
              <div key={response.id}>
                <SingleResponseCard
                  survey={survey}
                  response={response}
                  user={user}
                  environmentTags={environmentTags}
                  pageType="response"
                  environment={environment}
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
