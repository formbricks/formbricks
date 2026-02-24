import { getServerSession } from "next-auth";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { getDisplaysByContactId } from "@/lib/display/service";
import { getProjectByEnvironmentId } from "@/lib/project/service";
import { getResponsesByContactId } from "@/lib/response/service";
import { getSurveys } from "@/lib/survey/service";
import { getUser } from "@/lib/user/service";
import { findMatchingLocale } from "@/lib/utils/locale";
import { getTranslate } from "@/lingodotdev/server";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getProjectPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { ActivityTimeline } from "./activity-timeline";

interface ActivitySectionProps {
  environment: TEnvironment;
  contactId: string;
  environmentTags: TTag[];
}

export const ActivitySection = async ({ environment, contactId, environmentTags }: ActivitySectionProps) => {
  const [responses, displays] = await Promise.all([
    getResponsesByContactId(contactId),
    getDisplaysByContactId(contactId),
  ]);

  const allSurveyIds = [
    ...new Set([...(responses?.map((r) => r.surveyId) || []), ...displays.map((d) => d.surveyId)]),
  ];

  const surveys: TSurvey[] = allSurveyIds.length === 0 ? [] : ((await getSurveys(environment.id)) ?? []);

  const session = await getServerSession(authOptions);
  const t = await getTranslate();

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
    throw new Error(t("common.workspace_not_found"));
  }

  const projectPermission = await getProjectPermissionByUserId(session.user.id, project.id);
  const locale = await findMatchingLocale();

  return (
    <ActivityTimeline
      user={user}
      surveys={surveys}
      responses={responses}
      displays={displays}
      environment={environment}
      environmentTags={environmentTags}
      locale={locale}
      projectPermission={projectPermission}
    />
  );
};
