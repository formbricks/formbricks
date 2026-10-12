import "server-only";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import type { TSurveyVisibility } from "@formbricks/types/surveys/types";
import { skipV3AuditLog } from "@/app/api/v3/lib/audit";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import {
  problemBadRequest,
  problemForbidden,
  problemProjectionPending,
  problemVisibilityBlocked,
  problemVisibilityChangeNotAllowed,
  problemVisibilityNotEnabled,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { can } from "@/lib/authorization";
import { lockSurveyVisibility, reconcileSurveyRelationships } from "@/lib/authzed/survey";
import { getPendingVisibility } from "@/lib/survey/visibility/policy";
import { getAuthorizedV3Survey } from "../authorization";
import { type TV3SurveyResourceVisibility, serializeV3SurveyVisibilityFields } from "../serializers";
import { type TSurveyVisibilityBlocker, findSurveyOutboundBlockers } from "./blockers";
import { getSurveyVisibilityImpact } from "./impact";
import { ZV3SurveyVisibilityBody } from "./schemas";
import {
  type TVisibilityTransitionPlan,
  type TVisibilityTransitionRow,
  getAllowedVisibilityTargets,
  planVisibilityTransition,
} from "./transition";

/**
 * `GET` / `POST /api/v3/surveys/{surveyId}/visibility` (ENG-3282, contract §3).
 *
 * Both answer every caller who may not change the survey's visibility — unknown and foreign ids,
 * restricted surveys they cannot see, API keys, workspace members, team-level managers — with the one
 * shared 403 body, so nothing about the survey is probeable. `visibility_not_enabled` is a separate 403
 * because it depends only on the organization and the deployment, never on the survey.
 */

type TVisibilityOperationParams = Readonly<{
  authentication: TV3Authentication;
  instance: string;
  requestId: string;
  surveyId: string;
}>;

type TVisibilityRow = TVisibilityTransitionRow &
  Readonly<{
    id: string;
    visibilityChangedAt: Date | null;
    visibilityChangedById: string | null;
    workspaceId: string;
  }>;

const visibilityRowSelect = {
  id: true,
  ownerId: true,
  visibility: true,
  visibilityChangedAt: true,
  visibilityChangedById: true,
  visibilityProjectedVersion: true,
  visibilityVersion: true,
  workspaceId: true,
} as const;

const forbidden = (requestId: string, instance: string) =>
  problemForbidden(requestId, "You are not authorized to access this resource", instance);

type TAuthorizedVisibilityCaller =
  | Readonly<{ response: Response }>
  | Readonly<{
      organizationId: string;
      response: null;
      row: TVisibilityRow;
      userId: string;
      visibility: TV3SurveyResourceVisibility;
    }>;

/**
 * The shared gate: can see the survey, is a signed-in person, the feature is on, and holds
 * `survey.change_visibility`. The graph decides the last one even while a change is pending — who may
 * manage visibility does not depend on which value is in flight.
 */
async function authorizeVisibilityCaller({
  authentication,
  instance,
  requestId,
  surveyId,
}: TVisibilityOperationParams): Promise<TAuthorizedVisibilityCaller> {
  const actor = getV3AuthorizationActor(authentication);
  // API keys never manage visibility (K-4) — refused before anything reveals whether the id exists.
  if (actor?.type !== "user") return { response: forbidden(requestId, instance) };

  const { survey, authResult, response, visibility } = await getAuthorizedV3Survey({
    access: "read",
    authentication,
    instance,
    requestId,
    surveyId,
  });
  if (response) return { response };

  if (!visibility.gates.ready || !visibility.gates.entitled) {
    return { response: problemVisibilityNotEnabled(requestId, instance) };
  }
  if (!(await can(actor, "survey.change_visibility", { type: "survey", id: survey.id }))) {
    return { response: forbidden(requestId, instance) };
  }

  return {
    organizationId: authResult.organizationId,
    response: null,
    row: {
      id: survey.id,
      ownerId: survey.ownerId,
      visibility: survey.visibility,
      visibilityChangedAt: survey.visibilityChangedAt,
      visibilityChangedById: survey.visibilityChangedById,
      visibilityProjectedVersion: survey.visibilityProjectedVersion,
      visibilityVersion: survey.visibilityVersion,
      workspaceId: survey.workspaceId,
    },
    userId: actor.id,
    visibility,
  };
}

/** Connections only matter while `restricted` is a possible target: not for a settled restricted survey. */
const findRelevantBlockers = (row: TVisibilityRow): Promise<TSurveyVisibilityBlocker[]> =>
  row.visibility === "restricted" && getPendingVisibility(row) === null
    ? Promise.resolve([])
    : findSurveyOutboundBlockers(row.id, row.workspaceId);

export async function getV3SurveyVisibility(params: TVisibilityOperationParams): Promise<Response> {
  const log = logger.withContext({ requestId: params.requestId, surveyId: params.surveyId });

  try {
    const caller = await authorizeVisibilityCaller(params);
    if (caller.response) return caller.response;

    const { organizationId, row, visibility } = caller;
    const [blockers, impact] = await Promise.all([
      findRelevantBlockers(row),
      getSurveyVisibilityImpact(row, organizationId),
    ]);

    return successResponse(
      {
        id: row.id,
        ...serializeV3SurveyVisibilityFields(row, visibility.ownerName, visibility),
        blockers,
        impact,
        pending: getPendingVisibility(row),
        version: row.visibilityVersion,
        allowedTargets: getAllowedVisibilityTargets(row, blockers.length),
      },
      { requestId: params.requestId, cache: "private, no-store" }
    );
  } catch (error) {
    return mapV3ThrownError(error, {
      instance: params.instance,
      log,
      operation: "surveys.visibility.get",
      requestId: params.requestId,
    });
  }
}

/** `previous` is the row as read under the lock, before this change: what the audit records as old. */
type TStoredChange = Readonly<{
  plan: TVisibilityTransitionPlan;
  previous: TVisibilityRow;
  row: TVisibilityRow;
}>;

/**
 * Plan and store the change under the per-survey lock the projector also takes, so the version this
 * request writes can never be overtaken by projection work leased before it (Decision log #11).
 *
 * Raw SQL rather than a Prisma `update`: visibility is not survey content, so it must not bump
 * `updatedAt` — that would reorder every list and fail the next editor save's precondition with a 409.
 * The row is re-read under the lock: the plan is made against what is stored now, not what the
 * authorization read saw.
 */
const storeVisibilityChange = (
  surveyId: string,
  requested: TSurveyVisibility,
  blockerCount: number,
  userId: string
): Promise<TStoredChange> =>
  prisma.$transaction(async (tx) => {
    await lockSurveyVisibility(tx, surveyId);
    const previous = await tx.survey.findUniqueOrThrow({
      where: { id: surveyId },
      select: visibilityRowSelect,
    });
    const plan = planVisibilityTransition({ blockerCount, requested, row: previous });

    if (plan.kind !== "change" && plan.kind !== "cancel") return { plan, previous, row: previous };

    await tx.$executeRaw`
      UPDATE "Survey"
      SET "visibility" = ${plan.to}::"SurveyVisibility",
          "visibilityVersion" = "visibilityVersion" + 1,
          "visibilityChangedAt" = NOW(),
          "visibilityChangedById" = ${userId}
      WHERE id = ${surveyId}
    `;
    return {
      plan,
      previous,
      row: await tx.survey.findUniqueOrThrow({ where: { id: surveyId }, select: visibilityRowSelect }),
    };
  });

const readVisibilityRow = (surveyId: string): Promise<TVisibilityRow> =>
  prisma.survey.findUniqueOrThrow({ where: { id: surveyId }, select: visibilityRowSelect });

const serializeChangedBy = async (row: TVisibilityRow) => {
  if (!row.visibilityChangedById) return null;
  const user = await prisma.user.findUnique({
    where: { id: row.visibilityChangedById },
    select: { id: true, name: true },
  });
  return user ? { id: user.id, name: user.name, type: "user" as const } : null;
};

const toChangeResult = async (row: TVisibilityRow, visibility: TV3SurveyResourceVisibility) => ({
  id: row.id,
  ...serializeV3SurveyVisibilityFields(row, visibility.ownerName, visibility),
  version: row.visibilityVersion,
  pending: getPendingVisibility(row),
  changedAt: row.visibilityChangedAt?.toISOString() ?? null,
  changedBy: await serializeChangedBy(row),
});

export async function changeV3SurveyVisibility(
  params: TVisibilityOperationParams & Readonly<{ auditLog?: TV3AuditLog; body: unknown }>
): Promise<Response> {
  const { auditLog, body, instance, requestId, surveyId } = params;
  const log = logger.withContext({ requestId, surveyId });

  try {
    const parsed = ZV3SurveyVisibilityBody.safeParse(body);
    if (!parsed.success) {
      return problemBadRequest(requestId, "Invalid request body", {
        instance,
        invalid_params: parsed.error.issues.map((issue) => ({
          name: issue.path.join(".") || "body",
          reason: issue.message,
          ...(issue.code === "unrecognized_keys" ? { code: "unsupported_field" as const } : {}),
        })),
      });
    }

    const caller = await authorizeVisibilityCaller(params);
    if (caller.response) return caller.response;
    const { organizationId, userId, visibility } = caller;
    const requested = parsed.data.visibility;

    // Read outside the lock: attaching a connection does not take it. A race between a flip and an
    // attach is closed at dispatch instead, which skips a restricted survey whatever references it.
    const blockers = requested === "restricted" ? await findRelevantBlockers(caller.row) : [];
    const {
      plan,
      previous,
      row: stored,
    } = await storeVisibilityChange(surveyId, requested, blockers.length, userId);

    if (plan.kind === "reject") {
      log.warn({ code: plan.code, statusCode: plan.status }, "Survey visibility change refused");
      return plan.status === 422
        ? problemVisibilityChangeNotAllowed(requestId, instance)
        : problemVisibilityBlocked(requestId, blockers, instance);
    }

    if (auditLog) {
      auditLog.organizationId = organizationId;
      auditLog.targetId = surveyId;
    }

    if (plan.kind === "noop") {
      // Nothing written, nothing audited; changedAt/changedBy still describe the last real change.
      skipV3AuditLog(auditLog);
      return successResponse(await toChangeResult(stored, visibility), {
        requestId,
        cache: "private, no-store",
      });
    }

    // The fast path. Never throws — a failed projection comes back as a result, and the outbox event
    // the UPDATE enqueued will finish it within the delivery window either way.
    const projection = await reconcileSurveyRelationships([surveyId]);
    const row = await readVisibilityRow(surveyId);
    const pending = getPendingVisibility(row);

    if (plan.kind === "retry") {
      skipV3AuditLog(auditLog);
    } else if (auditLog) {
      // The row read under the lock, not the authorization read: a change that landed in between is the
      // real previous state.
      auditLog.oldObject = { version: previous.visibilityVersion, visibility: previous.visibility };
      auditLog.newObject = { version: stored.visibilityVersion, visibility: stored.visibility };
      // Stored and committed whatever the answer below: a 503 for a grant still changed the survey.
      auditLog.status = "success";
    }

    // A grant is only in effect once the graph holds this exact version; until then the survey stays
    // restricted and the caller is told so. A restriction is enforced the moment it is stored.
    if (plan.to === "workspace" && pending !== null) {
      log.warn(
        { projection: projection.status, version: stored.visibilityVersion },
        "Survey visibility grant stored but not yet projected"
      );
      return problemProjectionPending(requestId, instance);
    }

    return successResponse(await toChangeResult(row, visibility), { requestId, cache: "private, no-store" });
  } catch (error) {
    return mapV3ThrownError(error, { instance, log, operation: "surveys.visibility.change", requestId });
  }
}
