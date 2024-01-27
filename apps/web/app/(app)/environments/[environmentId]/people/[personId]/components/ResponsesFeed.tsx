"use client";

import { useEffect, useState } from "react";

import { TEnvironment } from "@formbricks/types/environment";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys";
import { TTag } from "@formbricks/types/tags";
import { TUser } from "@formbricks/types/user";
import EmptySpaceFiller from "@formbricks/ui/EmptySpaceFiller";
import SingleResponseCard from "@formbricks/ui/SingleResponseCard";

export default function ResponseFeed({
  responses,
  environment,
  surveys,
  user,
  environmentTags,
}: {
  responses: TResponse[];
  environment: TEnvironment;
  surveys: TSurvey[];
  user: TUser;
  environmentTags: TTag[];
}) {
  const [fetchedResponses, setFetchedResponses] = useState(responses);

  useEffect(() => {
    setFetchedResponses(responses);
  }, [responses]);

  return (
    <>
      {fetchedResponses.length === 0 ? (
        <EmptySpaceFiller type="response" environment={environment} />
      ) : (
        fetchedResponses.map((response) => {
          const survey = surveys.find((survey) => {
            return survey.id === response.surveyId;
          });
          return (
            <div key={response.id}>
              {survey && (
                <SingleResponseCard
                  response={response}
                  survey={survey}
                  user={user}
                  pageType="people"
                  environmentTags={environmentTags}
                  environment={environment}
                  setFetchedResponses={setFetchedResponses}
                />
              )}
            </div>
          );
        })
      )}
    </>
  );
}
