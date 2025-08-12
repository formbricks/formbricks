"use client";

import { useMembershipRole } from "@/lib/membership/hooks/useMembershipRole";
import { getAccessFlags } from "@/lib/membership/utils";
import { replaceHeadlineRecall } from "@/lib/utils/recall";
import { SingleResponseCard } from "@/modules/analysis/components/SingleResponseCard";
import { TTeamPermission } from "@/modules/ee/teams/project-teams/types/team";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { EmptySpaceFiller } from "@/modules/ui/components/empty-space-filler";
import { useEffect, useState } from "react";
import { TEnvironment } from "@formbricks/types/environment";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUser, TUserLocale } from "@formbricks/types/user";

interface ResponseTimelineProps {
  surveys: TSurvey[];
  user: TUser;
  responses: TResponse[];
  environment: TEnvironment;
  environmentTags: TTag[];
  locale: TUserLocale;
  projectPermission: TTeamPermission | null;
}

export const ResponseFeed = ({
  responses,
  environment,
  surveys,
  user,
  environmentTags,
  locale,
  projectPermission,
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
            locale={locale}
            projectPermission={projectPermission}
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
  locale,
  projectPermission,
}: {
  response: TResponse;
  surveys: TSurvey[];
  user: TUser;
  environmentTags: TTag[];
  environment: TEnvironment;
  deleteResponses: (responseIds: string[]) => void;
  updateResponse: (responseId: string, response: TResponse) => void;
  locale: TUserLocale;
  projectPermission: TTeamPermission | null;
}) => {
  const survey = surveys.find((survey) => {
    return survey.id === response.surveyId;
  });

  const { membershipRole } = useMembershipRole(survey?.environmentId || "", user.id);
  const { isMember } = getAccessFlags(membershipRole);

  const { hasReadAccess } = getTeamPermissionFlags(projectPermission);

  const isReadOnly = isMember && hasReadAccess;

  return (
    <div key={response.id}>
      {survey && (
        <SingleResponseCard
          response={response}
          survey={replaceHeadlineRecall(survey, "default")}
          user={user}
          environmentTags={environmentTags}
          environment={environment}
          deleteResponses={deleteResponses}
          updateResponse={updateResponse}
          isReadOnly={isReadOnly}
          locale={locale}
        />
      )}
    </div>
  );
};
