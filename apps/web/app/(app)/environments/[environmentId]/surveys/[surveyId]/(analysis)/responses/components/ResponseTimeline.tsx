"use client";
import EmptyInAppSurveys from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/EmptyInAppSurveys";
import EmptySpaceFiller from "@formbricks/ui/EmptySpaceFiller";
import { TEnvironment } from "@formbricks/types/environment";
import { TProfile } from "@formbricks/types/profile";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys";
import { TTag } from "@formbricks/types/tags";
import SingleResponseCard from "@formbricks/ui/SingleResponseCard";

interface ResponseTimelineProps {
  environment: TEnvironment;
  surveyId: string;
  responses: TResponse[];
  survey: TSurvey;
  profile: TProfile;
  environmentTags: TTag[];
}

export default function ResponseTimeline({
  environment,
  responses,
  survey,
  profile,
  environmentTags,
}: ResponseTimelineProps) {
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
                  profile={profile}
                  environmentTags={environmentTags}
                  pageType="response"
                  environment={environment}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
