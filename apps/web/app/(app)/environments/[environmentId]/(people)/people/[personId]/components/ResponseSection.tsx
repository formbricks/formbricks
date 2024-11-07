import { ResponseTimeline } from "@/app/(app)/environments/[environmentId]/(people)/people/[personId]/components/ResponseTimeline";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { authOptions } from "@formbricks/lib/authOptions";
import { getResponsesByPersonId } from "@formbricks/lib/response/service";
import { getSurveys } from "@formbricks/lib/survey/service";
import { getUser } from "@formbricks/lib/user/service";
import { findMatchingLocale } from "@formbricks/lib/utils/locale";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";

interface ResponseSectionProps {
  environment: TEnvironment;
  personId: string;
  environmentTags: TTag[];
  attributeClasses: TAttributeClass[];
}

export const ResponseSection = async ({
  environment,
  personId,
  environmentTags,
  attributeClasses,
}: ResponseSectionProps) => {
  const responses = await getResponsesByPersonId(personId);
  const surveyIds = responses?.map((response) => response.surveyId) || [];
  const surveys: TSurvey[] = surveyIds.length === 0 ? [] : ((await getSurveys(environment.id)) ?? []);
  const session = await getServerSession(authOptions);
  const t = await getTranslations();
  if (!session) {
    throw new Error(t("common.no_session_found"));
  }

  const user = await getUser(session.user.id);

  if (!user) {
    throw new Error(t("common.no_user_found"));
  }

  if (!responses) {
    throw new Error(t("environments.people.no_responses_found"));
  }
  const locale = findMatchingLocale();

  return (
    <ResponseTimeline
      user={user}
      surveys={surveys}
      responses={responses}
      environment={environment}
      environmentTags={environmentTags}
      attributeClasses={attributeClasses}
      locale={locale}
    />
  );
};
