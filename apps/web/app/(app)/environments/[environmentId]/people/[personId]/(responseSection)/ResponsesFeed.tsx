import EmptySpaceFiller from "@/components/shared/EmptySpaceFiller";
import { TResponse } from "@formbricks/types/v1/responses";
import { TSurvey } from "@formbricks/types/v1/surveys";
import SingleResponseCard from "@/components/shared/SingleResponseCard";
import { TEnvironment } from "@formbricks/types/v1/environment";
import { TTag } from "@formbricks/types/v1/tags";
export default function ResponseFeed({
  responses,
  environment,
  surveys,
  environmentTags,
}: {
  responses: TResponse[];
  environment: TEnvironment;
  surveys: TSurvey[];
  environmentTags: TTag[];
}) {
  return (
    <>
      {responses.length === 0 ? (
        <EmptySpaceFiller type="response" environment={environment} />
      ) : (
        responses.map((response, idx) => {
          const survey = surveys.find((survey) => {
            return survey.id === response.surveyId;
          });
          return (
            <div key={idx}>
              {survey && (
                <SingleResponseCard
                  response={response}
                  survey={survey}
                  pageType="people"
                  environmentTags={environmentTags}
                  environment={environment}
                />
              )}
            </div>
          );
        })
      )}
    </>
  );
}
