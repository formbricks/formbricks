"use client";
import EmptySpaceFiller from "@/components/shared/EmptySpaceFiller";
import { TResponse } from "@formbricks/types/v1/responses";
import { TSurvey } from "@formbricks/types/v1/surveys";
import SingleResponseCard from "@formbricks/ui/SingleResponseCard";
import EmptyInAppSurveys from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/EmptyInAppSurveys";
import { TEnvironment } from "@formbricks/types/v1/environment";
import { TTag } from "@formbricks/types/v1/tags";

interface ResponseTimelineProps {
  environment: TEnvironment;
  surveyId: string;
  responses: TResponse[];
  survey: TSurvey;
  environmentTags: TTag[];
}

export default function ResponseTimeline({
  environment,
  responses,
  survey,
  environmentTags,
}: ResponseTimelineProps) {
  return (
    <div className="space-y-4">
      {survey.type === "web" && !environment.widgetSetupCompleted ? (
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
