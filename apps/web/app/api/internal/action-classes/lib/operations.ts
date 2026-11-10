import "server-only";
import type { TActionClass } from "@formbricks/types/action-classes";
import { UniqueConstraintError } from "@formbricks/types/errors";
import { getV3SessionUserId, requireSessionWorkspaceAccess } from "@/app/api/v3/lib/auth";
import { applyRateLimitOrRespond } from "@/app/api/v3/lib/operation-rate-limit";
import {
  createdResponse,
  noContentResponse,
  problemConflict,
  problemForbidden,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { deleteActionClass, getActionClass, updateActionClass } from "@/lib/actionClass/service";
import { capturePostHogEvent } from "@/lib/posthog";
import { getSurveysByActionClassId } from "@/lib/survey/service";
import { getUserVisibleSurveyWhere } from "@/lib/survey/visibility/actor-context";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import type { TTeamPermission } from "@/modules/ee/teams/workspace-teams/types/team";
import { createActionClass } from "@/modules/survey/editor/lib/action-class";
import type { TActionClassCreateBody, TActionClassPatchBody, TActionClassSurveysResource } from "../schemas";

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

/**
 * `POST /api/internal/action-classes?workspaceId=`: create an action, from the survey editor's trigger
 * picker. `readWrite` on the workspace, and a write spends the workspace's shared settings-write budget,
 * as the server action it replaces did. The workspace is the authorized query's; the body's is ignored.
 */
export async function createActionClassOperation({
  authentication,
  workspaceId,
  body,
  requestId,
  instance,
  auditLog,
}: Omit<TRequestContext, "actionClassId"> & {
  workspaceId: string;
  body: TActionClassCreateBody;
}): Promise<Response> {
  const access = await requireSessionWorkspaceAccess(
    authentication,
    workspaceId,
    "readWrite",
    requestId,
    instance
  );
  if (access instanceof Response) return access;
  const { organizationId } = access;
  if (auditLog) auditLog.organizationId = organizationId;

  const limited = await applyRateLimitOrRespond(rateLimitConfigs.actions.stateMutation, access.workspaceId, {
    requestId,
    instance,
  });
  if (limited) return limited;

  let created: TActionClass;
  try {
    created = await createActionClass(access.workspaceId, { ...body, workspaceId: access.workspaceId });
  } catch (error) {
    // A name or key the workspace already uses. Its message names which, and the form shows it.
    if (error instanceof UniqueConstraintError) return problemConflict(requestId, error.message, instance);
    throw error;
  }

  if (auditLog) {
    auditLog.targetId = created.id;
    auditLog.newObject = created;
  }

  const userId = getV3SessionUserId(authentication);
  if (userId) {
    capturePostHogEvent(
      userId,
      "action_class_created",
      {
        organization_id: organizationId,
        workspace_id: access.workspaceId,
        type: body.type,
        trigger_type: body.type === "code" ? "codeAction" : (body.noCodeConfig?.type ?? "noCode"),
      },
      { organizationId, workspaceId: access.workspaceId }
    );
  }

  return createdResponse(serializeActionClass(created), {
    location: `/api/internal/action-classes/${created.id}`,
    requestId,
  });
}

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
