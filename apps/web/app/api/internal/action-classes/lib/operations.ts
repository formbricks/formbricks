import "server-only";
import type { TActionClass } from "@formbricks/types/action-classes";
import { requireSessionWorkspaceAccess } from "@/app/api/v3/lib/auth";
import { noContentResponse, problemForbidden, successResponse } from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { deleteActionClass, getActionClass, updateActionClass } from "@/lib/actionClass/service";
import { getSurveysByActionClassId } from "@/lib/survey/service";
import { getUserVisibleSurveyWhere } from "@/lib/survey/visibility/actor-context";
import type { TTeamPermission } from "@/modules/ee/teams/workspace-teams/types/team";
import type { TActionClassPatchBody, TActionClassSurveysResource } from "../schemas";

/**
 * A workspace's actions (action classes), as its app connection settings edit them. Each is authorized
 * against the workspace it belongs to, read off its row; a missing action answers like one the caller
 * can't reach.
 */

type TRequestContext = {
  authentication: TV3Authentication;
  actionClassId: string;
  requestId: string;
  instance?: string;
  auditLog?: TV3AuditLog;
};

async function authorizeActionClass(context: TRequestContext, permission: TTeamPermission) {
  const { authentication, actionClassId, requestId, instance, auditLog } = context;
  if (auditLog) auditLog.targetId = actionClassId;

  const actionClass = await getActionClass(actionClassId);
  if (!actionClass) return problemForbidden(requestId, undefined, instance);

  const access = await requireSessionWorkspaceAccess(
    authentication,
    actionClass.workspaceId,
    permission,
    requestId,
    instance
  );
  if (access instanceof Response) return access;
  if (auditLog) auditLog.organizationId = access.organizationId;
  return { actionClass, organizationId: access.organizationId };
}

/**
 * The action's own fields. The stored row also carries `surveyTriggers` — the id of every survey it
 * triggers, restricted ones included — which is not the caller's to see (`/surveys` names only visible ones).
 */
const serializeActionClass = ({
  id,
  name,
  description,
  type,
  key,
  noCodeConfig,
  workspaceId,
  createdAt,
  updatedAt,
}: TActionClass): TActionClass => ({
  id,
  name,
  description,
  type,
  key,
  noCodeConfig,
  workspaceId,
  createdAt,
  updatedAt,
});

/** `PATCH /api/internal/action-classes/{actionClassId}`: change an action. */
export async function updateActionClassOperation({
  body,
  ...context
}: TRequestContext & { body: TActionClassPatchBody }): Promise<Response> {
  const authorized = await authorizeActionClass(context, "readWrite");
  if (authorized instanceof Response) return authorized;
  const { actionClass } = authorized;

  // Always the action's own workspace: the body can't move an action to another one.
  const updated = await updateActionClass(actionClass.workspaceId, actionClass.id, {
    ...body,
    workspaceId: actionClass.workspaceId,
  });
  if (context.auditLog) {
    context.auditLog.oldObject = actionClass;
    context.auditLog.newObject = updated;
  }
  return successResponse(serializeActionClass(updated), { requestId: context.requestId });
}

/** `DELETE /api/internal/action-classes/{actionClassId}`: delete an action. */
export async function deleteActionClassOperation(context: TRequestContext): Promise<Response> {
  const authorized = await authorizeActionClass(context, "readWrite");
  if (authorized instanceof Response) return authorized;

  await deleteActionClass(authorized.actionClass.id);
  if (context.auditLog) context.auditLog.oldObject = authorized.actionClass;
  return noContentResponse({ requestId: context.requestId });
}

/**
 * `GET /api/internal/action-classes/{actionClassId}/surveys`: the surveys this action triggers, by name —
 * only those the caller may see (ENG-3282).
 */
export async function getActionClassSurveysOperation({
  excludeSurveyId,
  ...context
}: TRequestContext & { excludeSurveyId?: string }): Promise<Response> {
  const authorized = await authorizeActionClass(context, "read");
  if (authorized instanceof Response) return authorized;
  const { actionClass, organizationId } = authorized;
  const userId =
    context.authentication && "user" in context.authentication ? context.authentication.user.id : "";

  const surveys = (
    await getSurveysByActionClassId(
      actionClass.id,
      actionClass.workspaceId,
      await getUserVisibleSurveyWhere(userId, organizationId)
    )
  ).filter((survey) => survey.id !== excludeSurveyId);

  return successResponse<TActionClassSurveysResource>(
    {
      activeSurveys: surveys.filter((survey) => survey.status === "inProgress").map((survey) => survey.name),
      inactiveSurveys: surveys
        .filter((survey) => survey.status !== "inProgress")
        .map((survey) => survey.name),
    },
    { requestId: context.requestId }
  );
}
