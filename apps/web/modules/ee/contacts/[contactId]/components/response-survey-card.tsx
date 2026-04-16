"use client";

import { TResponseWithQuotas } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUser, TUserLocale } from "@formbricks/types/user";
import { replaceHeadlineRecall } from "@/lib/utils/recall";
import { SingleResponseCard } from "@/modules/analysis/components/SingleResponseCard";

interface ResponseSurveyCardProps {
  response: TResponseWithQuotas;
  surveys: TSurvey[];
  user: TUser;
  environmentTags: TTag[];
  updateResponseList: (responseIds: string[]) => void;
  updateResponse: (responseId: string, response: TResponseWithQuotas) => void;
  locale: TUserLocale;
  isReadOnly: boolean;
}

export const ResponseSurveyCard = ({
  response,
  surveys,
  user,
  environmentTags,
  updateResponseList,
  updateResponse,
  locale,
  isReadOnly,
}: ResponseSurveyCardProps) => {
  const survey = surveys.find((s) => s.id === response.surveyId);

  if (!survey) return null;

  return (
    <SingleResponseCard
      response={response}
      survey={replaceHeadlineRecall(survey, "default")}
      user={user}
      environmentTags={environmentTags}
      updateResponseList={updateResponseList}
      updateResponse={updateResponse}
      isReadOnly={isReadOnly}
      locale={locale}
    />
  );
};
