"use client";

import { useEffect, useState } from "react";
import { useMembershipRole } from "@formbricks/lib/membership/hooks/useMembershipRole";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { replaceHeadlineRecall } from "@formbricks/lib/utils/recall";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TEnvironment } from "@formbricks/types/environment";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUser } from "@formbricks/types/user";
import { EmptySpaceFiller } from "@formbricks/ui/components/EmptySpaceFiller";
import { SingleResponseCard } from "@formbricks/ui/components/SingleResponseCard";

interface ResponseTimelineProps {
  surveys: TSurvey[];
  user: TUser;
  responses: TResponse[];
  environment: TEnvironment;
  environmentTags: TTag[];
  contactAttributeKeys: TContactAttributeKey[];
}

export const ResponseFeed = ({
  responses,
  environment,
  surveys,
  user,
  environmentTags,
  contactAttributeKeys,
}: ResponseTimelineProps) => {
  const [fetchedResponses, setFetchedResponses] = useState(responses);

  useEffect(() => {
    setFetchedResponses(responses);
  }, [responses]);

  const deleteResponses = (responseIds: string[]) => {
    setFetchedResponses(responses.filter((response) => !responseIds.includes(response.id)));
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
            deleteResponses={deleteResponses}
            updateResponse={updateResponse}
            contactAttributeKeys={contactAttributeKeys}
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
  deleteResponses,
  updateResponse,
  contactAttributeKeys,
}: {
  response: TResponse;
  surveys: TSurvey[];
  user: TUser;
  environmentTags: TTag[];
  environment: TEnvironment;
  deleteResponses: (responseIds: string[]) => void;
  updateResponse: (responseId: string, response: TResponse) => void;
  contactAttributeKeys: TContactAttributeKey[];
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
          survey={replaceHeadlineRecall(survey, "default", contactAttributeKeys)}
          user={user}
          pageType="people"
          environmentTags={environmentTags}
          environment={environment}
          deleteResponses={deleteResponses}
          updateResponse={updateResponse}
          isViewer={isViewer}
        />
      )}
    </div>
  );
};
