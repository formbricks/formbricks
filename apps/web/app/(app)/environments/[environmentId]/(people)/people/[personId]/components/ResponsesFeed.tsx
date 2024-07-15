"use client";

import { useEffect, useState } from "react";
import { useMembershipRole } from "@formbricks/lib/membership/hooks/useMembershipRole";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { replaceHeadlineRecall } from "@formbricks/lib/utils/recall";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TEnvironment } from "@formbricks/types/environment";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUser } from "@formbricks/types/user";
import { EmptySpaceFiller } from "@formbricks/ui/EmptySpaceFiller";
import { SingleResponseCard } from "@formbricks/ui/SingleResponseCard";

interface ResponseTimelineProps {
  surveys: TSurvey[];
  user: TUser;
  responses: TResponse[];
  environment: TEnvironment;
  environmentTags: TTag[];
  attributeClasses: TAttributeClass[];
}

export const ResponseFeed = ({
  responses,
  environment,
  surveys,
  user,
  environmentTags,
  attributeClasses,
}: ResponseTimelineProps) => {
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
            attributeClasses={attributeClasses}
          />
        ))
      )}
    </>
  );
};

const ResponseSurveyCard = ({
  response,
  surveys,
  user,
  environmentTags,
  environment,
  deleteResponse,
  updateResponse,
  attributeClasses,
}: {
  response: TResponse;
  surveys: TSurvey[];
  user: TUser;
  environmentTags: TTag[];
  environment: TEnvironment;
  deleteResponse: (responseId: string) => void;
  updateResponse: (responseId: string, response: TResponse) => void;
  attributeClasses: TAttributeClass[];
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
          survey={replaceHeadlineRecall(survey, "default", attributeClasses)}
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
