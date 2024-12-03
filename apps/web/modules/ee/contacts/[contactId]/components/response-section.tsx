import { authOptions } from "@/modules/auth/lib/authOptions";
import { getProjectPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { getProjectByEnvironmentId } from "@formbricks/lib/project/service";
import { getResponsesByContactId } from "@formbricks/lib/response/service";
import { getSurveys } from "@formbricks/lib/survey/service";
import { getUser } from "@formbricks/lib/user/service";
import { findMatchingLocale } from "@formbricks/lib/utils/locale";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
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

  const t = await getTranslations();
  if (!session) {
    throw new Error(t("common.session_not_found"));
  }

  const user = await getUser(session.user.id);

  if (!user) {
    throw new Error(t("common.user_not_found"));
  }

  if (!responses) {
    throw new Error(t("environments.contacts.no_responses_found"));
  }

  const project = await getProjectByEnvironmentId(environment.id);

  if (!project) {
    throw new Error(t("common.project_not_found"));
  }

  const projectPermission = await getProjectPermissionByUserId(session.user.id, project.id);

  const locale = await findMatchingLocale();

  return (
    <ResponseTimeline
      user={user}
      surveys={surveys}
      responses={responses}
      environment={environment}
      environmentTags={environmentTags}
      contactAttributeKeys={contactAttributeKeys}
      locale={locale}
      projectPermission={projectPermission}
    />
  );
};
