import EmptySpaceFiller from "@formbricks/ui/EmptySpaceFiller";
import { TEnvironment } from "@formbricks/types/environment";
import { TUser } from "@formbricks/types/user";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys";
import { TTag } from "@formbricks/types/tags";
import SingleResponseCard from "@formbricks/ui/SingleResponseCard";

export default async function ResponseFeed({
  responses,
  environment,
  surveys,
  user,
  environmentTags,
}: {
  responses: TResponse[];
  environment: TEnvironment;
  surveys: TSurvey[];
  user: TUser;
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
                  user={user}
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
