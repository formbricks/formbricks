"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TEnvironment } from "@formbricks/types/environment";
import { TResponseWithQuotas } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUser, TUserLocale } from "@formbricks/types/user";
import { useMembershipRole } from "@/lib/membership/hooks/useMembershipRole";
import { getAccessFlags } from "@/lib/membership/utils";
import { replaceHeadlineRecall } from "@/lib/utils/recall";
import { SingleResponseCard } from "@/modules/analysis/components/SingleResponseCard";
import { TTeamPermission } from "@/modules/ee/teams/project-teams/types/team";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { EmptyState } from "@/modules/ui/components/empty-state";

interface ResponseTimelineProps {
  surveys: TSurvey[];
  user: TUser;
  responses: TResponseWithQuotas[];
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
  const { t } = useTranslation();
  const [fetchedResponses, setFetchedResponses] = useState(responses);

  useEffect(() => {
    setFetchedResponses(responses);
  }, [responses]);

  const updateResponseList = (responseIds: string[]) => {
    setFetchedResponses((prev) => prev.filter((r) => !responseIds.includes(r.id)));
  };

  const updateResponse = (responseId: string, updatedResponse: TResponseWithQuotas) => {
    setFetchedResponses((prev) => prev.map((r) => (r.id === responseId ? updatedResponse : r)));
  };

  return (
    <>
      {fetchedResponses.length === 0 ? (
        <EmptyState text={t("environments.contacts.no_responses_found")} />
      ) : (
        fetchedResponses.map((response) => (
          <ResponseSurveyCard
            key={response.id}
            response={response}
            surveys={surveys}
            user={user}
            environmentTags={environmentTags}
            environment={environment}
            updateResponseList={updateResponseList}
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
  updateResponseList,
  updateResponse,
  locale,
  projectPermission,
}: {
  response: TResponseWithQuotas;
  surveys: TSurvey[];
  user: TUser;
  environmentTags: TTag[];
  environment: TEnvironment;
  updateResponseList: (responseIds: string[]) => void;
  updateResponse: (responseId: string, response: TResponseWithQuotas) => void;
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
          updateResponseList={updateResponseList}
          updateResponse={updateResponse}
          isReadOnly={isReadOnly}
          locale={locale}
        />
      )}
    </div>
  );
};
