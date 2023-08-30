import EmptySpaceFiller from "@/components/shared/EmptySpaceFiller";
import { TResponse } from "@formbricks/types/v1/responses";
import { TSurvey } from "@formbricks/types/v1/surveys";
import SingleResponseCard from "@/components/shared/SingleResponseCard";

export default function ResponseFeed({
  responses,
  environmentId,
  surveys,
}: {
  responses: TResponse[];
  environmentId: string;
  surveys: TSurvey[];
}) {
  return (
    <>
      {responses.length === 0 ? (
        <EmptySpaceFiller type="response" environmentId={environmentId} />
      ) : (
        responses.map((response, idx) => {
          const survey = surveys.find((survey) => {
            return survey.id === response.surveyId;
          });
          return (
            <div key={idx}>
              {survey && <SingleResponseCard response={response} survey={survey} pageType="people" />}
            </div>
          );
        })
      )}
    </>
  );
}
