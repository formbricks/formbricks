import { getServerSession } from "next-auth";
import { authOptions } from "@formbricks/lib/authOptions";
import { getResponsesByContactId } from "@formbricks/lib/response/service";
import { getSurveys } from "@formbricks/lib/survey/service";
import { getUser } from "@formbricks/lib/user/service";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-keys";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { ResponseTimeline } from "./response-timeline";

interface ResponseSectionProps {
  environment: TEnvironment;
  contactId: string;
  environmentTags: TTag[];
  contactAttributeKeys: TContactAttributeKey[];
}

export const ResponseSection = async ({
  environment,
  contactId,
  environmentTags,
  contactAttributeKeys,
}: ResponseSectionProps) => {
  const responses = await getResponsesByContactId(contactId);
  const surveyIds = responses?.map((response) => response.surveyId) || [];
  const surveys: TSurvey[] = surveyIds.length === 0 ? [] : ((await getSurveys(environment.id)) ?? []);
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new Error("No session found");
  }

  const user = await getUser(session.user.id);

  if (!user) {
    throw new Error("No user found");
  }

  if (!responses) {
    throw new Error("No responses found");
  }

  return (
    <ResponseTimeline
      user={user}
      surveys={surveys}
      responses={responses}
      environment={environment}
      environmentTags={environmentTags}
      contactAttributeKeys={contactAttributeKeys}
    />
  );
};
