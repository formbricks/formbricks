import ResponseTimeline from "@/app/(app)/environments/[environmentId]/people/[personId]/components/ResponseTimeline";
import { authOptions } from "@formbricks/lib/authOptions";
import { getResponsesByPersonId } from "@formbricks/lib/response/service";
import { getSurveys } from "@formbricks/lib/survey/service";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey } from "@formbricks/types/surveys";
import { TTag } from "@formbricks/types/tags";
import { getServerSession } from "next-auth";

export default async function ResponseSection({
  environment,
  personId,
  environmentTags,
}: {
  environment: TEnvironment;
  personId: string;
  environmentTags: TTag[];
}) {
  const responses = await getResponsesByPersonId(personId);
  const surveyIds = responses?.map((response) => response.surveyId) || [];
  const surveys: TSurvey[] = surveyIds.length === 0 ? [] : (await getSurveys(environment.id)) ?? [];
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new Error("No session found");
  }

  return (
    <>
      {responses && (
        <ResponseTimeline
          profile={session.user}
          surveys={surveys}
          responses={responses}
          environment={environment}
          environmentTags={environmentTags}
        />
      )}
    </>
  );
}
