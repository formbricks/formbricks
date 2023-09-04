"use client";
import EmptySpaceFiller from "@/components/shared/EmptySpaceFiller";
import { TResponse } from "@formbricks/types/v1/responses";
import { TSurvey } from "@formbricks/types/v1/surveys";
import SingleResponseCard from "@/components/shared/SingleResponseCard";

interface ResponseTimelineProps {
  environmentId: string;
  surveyId: string;
  responses: TResponse[];
  survey: TSurvey;
}

export default function ResponseTimeline({ environmentId, responses, survey }: ResponseTimelineProps) {
  return (
    <div className="space-y-4">
      {responses.length === 0 ? (
        <EmptySpaceFiller
          type="response"
          environmentId={environmentId}
          noWidgetRequired={survey.type === "link"}
        />
      ) : (
        <div>
          {responses.map((response) => {
            return<div key={response.id}>
             <SingleResponseCard survey={survey} response={response} pageType="response" />
            </div>
          })}
        </div>
      )}
    </div>
  );
}
