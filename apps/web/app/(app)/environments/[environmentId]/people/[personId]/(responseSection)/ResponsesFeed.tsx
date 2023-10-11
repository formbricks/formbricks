import EmptySpaceFiller from "@/components/shared/EmptySpaceFiller";
import { TEnvironment } from "@formbricks/types/v1/environment";
import { TProfile } from "@formbricks/types/v1/profile";
import { TResponse } from "@formbricks/types/v1/responses";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { TTag } from "@formbricks/types/v1/tags";
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
