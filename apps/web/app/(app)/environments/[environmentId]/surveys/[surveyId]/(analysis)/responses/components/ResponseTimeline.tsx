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
  const [displayedResponses, setDisplayedResponses] = useState<TResponse[]>([]);
  const loadingRef = useRef(null);
  let newResponses = responses;
  const [page, setPage] = useState(2);
  useEffect(() => {
    setDisplayedResponses(responses.slice(0, responsesPerPage));
  }, [responses, setDisplayedResponses, responsesPerPage]);

  useEffect(() => {
    const currentLoadingRef = loadingRef.current;

    const loadResponses = async () => {
      newResponses = await getMoreResponses(survey.id, page);
      if (newResponses.length > 0) {
        setPage(page + 1);
      }
      setDisplayedResponses((prevResponses) => [...prevResponses, ...newResponses]);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          if (newResponses.length > 0) loadResponses();
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
  }, [responses, responsesPerPage, page]);

  return (
    <div className="space-y-4">
      {survey.type === "web" && displayedResponses.length === 0 && !environment.widgetSetupCompleted ? (
        <EmptyInAppSurveys environment={environment} />
      ) : displayedResponses.length === 0 ? (
        <EmptySpaceFiller
          type="response"
          environment={environment}
          noWidgetRequired={survey.type === "link"}
        />
      ) : (
        <div>
          {displayedResponses.map((response) => {
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
