"use client";

import { useEffect, useState } from "react";

import { useMembershipRole } from "@formbricks/lib/membership/hooks/useMembershipRole";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { checkForRecallInHeadline } from "@formbricks/lib/utils/recall";
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

  const deleteResponse = (responseId: string) => {
    setFetchedResponses(responses.filter((response) => response.id !== responseId));
  };

  const updateResponse = (responseId: string, updatedResponse: TResponse) => {
    setFetchedResponses(
      responses.map((response) => (response.id === responseId ? updatedResponse : response))
    );
  };

  return (
    <>
      {fetchedResponses.length === 0 ? (
        <EmptySpaceFiller type="response" environment={environment} />
      ) : (
        fetchedResponses.map((response) => (
          <ResponseSurveyCard
            key={response.id}
            response={response}
            surveys={surveys}
            user={user}
            environmentTags={environmentTags}
            environment={environment}
            deleteResponse={deleteResponse}
            updateResponse={updateResponse}
          />
        ))
      )}
    </>
  );
}

const ResponseSurveyCard = ({
  response,
  surveys,
  user,
  environmentTags,
  environment,
  deleteResponse,
  updateResponse,
}: {
  response: TResponse;
  surveys: TSurvey[];
  user: TUser;
  environmentTags: TTag[];
  environment: TEnvironment;
  deleteResponse: (responseId: string) => void;
  updateResponse: (responseId: string, response: TResponse) => void;
}) => {
  const survey = surveys.find((survey) => {
    return survey.id === response.surveyId;
  });

  const { membershipRole } = useMembershipRole(survey?.environmentId || "");
  const { isViewer } = getAccessFlags(membershipRole);

  return (
    <div key={response.id}>
      {survey && (
        <SingleResponseCard
          response={response}
          survey={checkForRecallInHeadline(survey, "default")}
          user={user}
          pageType="people"
          environmentTags={environmentTags}
          environment={environment}
          deleteResponse={deleteResponse}
          updateResponse={updateResponse}
          isViewer={isViewer}
        />
      )}
    </div>
  );
};
