import EmptySpaceFiller from "@formbricks/ui/EmptySpaceFiller";
import { TEnvironment } from "@formbricks/types/environment";
import { TProfile } from "@formbricks/types/profile";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys";
import { TTag } from "@formbricks/types/tags";
import SingleResponseCard from "@formbricks/ui/SingleResponseCard";

export default async function ResponseFeed({
  responses,
  environment,
  surveys,
  profile,
  environmentTags,
}: {
  responses: TResponse[];
  environment: TEnvironment;
  surveys: TSurvey[];
  profile: TProfile;
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
                  profile={profile}
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
