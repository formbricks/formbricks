import type { Prisma } from "@formbricks/database/prisma";
import { AuthenticationError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { DEFAULT_LOCALE } from "@/lib/constants";
import { getDisplaysByContactId } from "@/lib/display/service";
import { getResponsesByContactId } from "@/lib/response/service";
import { getSurveys } from "@/lib/survey/service";
import { getUser } from "@/lib/user/service";
import { getWorkspace } from "@/lib/workspace/service";
import { getTranslate } from "@/lingodotdev/server";
import { getSession } from "@/modules/auth/lib/session";
import { getWorkspacePermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { ActivityTimeline } from "./activity-timeline";

interface ActivitySectionProps {
  workspaceId: string;
  contactId: string;
  environmentTags: TTag[];
  visibleSurveyWhere: Prisma.SurveyWhereInput;
}

export const ActivitySection = async ({
  workspaceId,
  contactId,
  environmentTags,
  visibleSurveyWhere,
}: Readonly<ActivitySectionProps>) => {
  const [responses, displays, workspace] = await Promise.all([
    getResponsesByContactId(contactId, workspaceId, visibleSurveyWhere),
    getDisplaysByContactId(contactId, workspaceId, visibleSurveyWhere),
    getWorkspace(workspaceId),
  ]);

  if (!workspace) {
    throw new ResourceNotFoundError("Workspace", null);
  }

  const allSurveyIds = [
    ...new Set([...(responses?.map((r) => r.surveyId) || []), ...displays.map((d) => d.surveyId)]),
  ];

  const surveys: TSurvey[] =
    allSurveyIds.length === 0 ? [] : ((await getSurveys(workspace.id, visibleSurveyWhere)) ?? []);

  const session = await getSession();
  const t = await getTranslate();

  if (!session) {
    throw new AuthenticationError(t("common.not_authenticated"));
  }

  const user = await getUser(session.user.id);
  if (!user) {
    throw new AuthenticationError(t("common.not_authenticated"));
  }

  if (!responses) {
    throw new Error(t("workspace.contacts.no_responses_found"));
  }

  const workspacePermission = await getWorkspacePermissionByUserId(session.user.id, workspace.id);
  const locale = user.locale ?? DEFAULT_LOCALE;

  return (
    <ActivityTimeline
      user={user}
      surveys={surveys}
      responses={responses}
      displays={displays}
      workspaceId={workspaceId}
      environmentTags={environmentTags}
      locale={locale}
      workspacePermission={workspacePermission}
    />
  );
};
