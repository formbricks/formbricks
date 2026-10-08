import "server-only";
import { addYears } from "date-fns";
import { prisma } from "@formbricks/database";
import { buildKeysetPage } from "@/app/api/v3/lib/keyset-cursor";
import {
  createdResponse,
  problemForbidden,
  problemUnprocessableContent,
  successListResponse,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { requireRetentionOrgAccess } from "@/modules/ee/data-retention/lib/api-access";
import { readDatabaseClock } from "@/modules/ee/data-retention/lib/database-clock";
import {
  confirmReadableRetentionExemptions,
  resolveRetentionExemptionReadScope,
} from "@/modules/ee/data-retention/lib/exemption-read-scope";
import {
  RetentionExemptionExistsError,
  createRetentionExemption,
  findRetentionExemption,
  getRetentionExemptionOrganizationId,
  getRetentionExemptionSurvey,
  listRetentionExemptionKeysetPage,
  revokeRetentionExemption,
  searchRetentionExemptionSurveys,
} from "@/modules/ee/data-retention/lib/exemptions-service";
import { RETENTION_EXEMPTION_MAX_YEARS } from "@/modules/ee/data-retention/types";
import {
  RETENTION_EXEMPTIONS_CURSOR_KIND,
  RETENTION_EXEMPTIONS_SORT,
  type TCreateRetentionExemptionBody,
  type TRetentionExemptionSurveyOptionsQuery,
  type TRetentionExemptionsListQuery,
} from "../schemas";
import { serializeRetentionExemption } from "../serializers";

const EXEMPTIONS_PATH = "/api/internal/retention-exemptions";

type TRequestContext = {
  authentication: TV3Authentication;
  requestId: string;
  instance?: string;
};

/**
 * The active exemptions, newest first. Every member may read them (ENG-3695), but only for surveys
 * they could open themselves; the filter is in SQL, so pages and cursors stay exact.
 */
export async function listRetentionExemptionsOperation({
  authentication,
  query,
  requestId,
  instance,
}: TRequestContext & { query: TRetentionExemptionsListQuery }): Promise<Response> {
  const access = await requireRetentionOrgAccess({
    authentication,
    organizationId: query.organizationId,
    action: "organization.read_access",
    requestId,
    instance,
  });
  if (access instanceof Response) return access;

  const scope = await resolveRetentionExemptionReadScope(access.userId, access.organizationId);
  const rows = await listRetentionExemptionKeysetPage({
    organizationId: access.organizationId,
    scope,
    now: new Date(),
    limit: query.limit,
    cursor: query.cursor,
  });

  const { page, nextCursor } = buildKeysetPage({
    rows,
    limit: query.limit,
    kind: RETENTION_EXEMPTIONS_CURSOR_KIND,
    sortBy: RETENTION_EXEMPTIONS_SORT,
    fp: query.fingerprint,
    sortValue: (exemption) => exemption.createdAt,
  });

  // After paging, so the cursor still follows the rows the query walked.
  const readable = await confirmReadableRetentionExemptions(access.userId, scope, page);

  return successListResponse(
    readable.map(serializeRetentionExemption),
    { limit: query.limit, nextCursor },
    { requestId }
  );
}

/**
 * One exemption, active or not: the `Location` of a created one. A missing exemption, one in another
 * organisation and one whose survey the caller can't open are the same 403.
 */
export async function getRetentionExemptionOperation({
  authentication,
  exemptionId,
  requestId,
  instance,
}: TRequestContext & { exemptionId: string }): Promise<Response> {
  const organizationId = await getRetentionExemptionOrganizationId(exemptionId);
  if (!organizationId) return problemForbidden(requestId, undefined, instance);

  const access = await requireRetentionOrgAccess({
    authentication,
    organizationId,
    action: "organization.read_access",
    requestId,
    instance,
  });
  if (access instanceof Response) return access;

  const scope = await resolveRetentionExemptionReadScope(access.userId, access.organizationId);
  const found = await findRetentionExemption({
    id: exemptionId,
    organizationId: access.organizationId,
    scope,
  });
  const [exemption] = found ? await confirmReadableRetentionExemptions(access.userId, scope, [found]) : [];
  if (!exemption) return problemForbidden(requestId, undefined, instance);

  return successResponse(serializeRetentionExemption(exemption), { requestId });
}

/** `until` must be in the future and at most `RETENTION_EXEMPTION_MAX_YEARS` ahead (ENG-3346). */
const getUntilProblem = (until: Date, now: Date): string | null => {
  if (until <= now) return "The exemption must end in the future.";
  if (until > addYears(now, RETENTION_EXEMPTION_MAX_YEARS)) {
    return `The exemption can end at most ${RETENTION_EXEMPTION_MAX_YEARS} years from now.`;
  }
  return null;
};

/**
 * Exempt a survey from one policy. The organisation is the survey's, never the caller's say; a missing
 * survey and one the caller can't manage are the same 403. Owners and managers only.
 */
export async function createRetentionExemptionOperation({
  authentication,
  body,
  requestId,
  instance,
  auditLog,
}: TRequestContext & { body: TCreateRetentionExemptionBody; auditLog?: TV3AuditLog }): Promise<Response> {
  // What was asked for, so a refused or failed attempt is still attributable in the audit log.
  if (auditLog) auditLog.newObject = { surveyId: body.surveyId, policy: body.policy };

  const survey = await getRetentionExemptionSurvey(body.surveyId);
  if (!survey) return problemForbidden(requestId, undefined, instance);

  const access = await requireRetentionOrgAccess({
    authentication,
    organizationId: survey.organizationId,
    action: "organization.manage",
    requestId,
    instance,
  });
  if (access instanceof Response) return access;
  if (auditLog) auditLog.organizationId = access.organizationId;

  // The database's clock: an exemption's start and end are compared with notice times it stamps.
  const now = await readDatabaseClock(prisma);
  const untilProblem = getUntilProblem(body.until, now);
  if (untilProblem) {
    return problemUnprocessableContent(requestId, untilProblem, {
      instance,
      invalid_params: [{ name: "until", reason: untilProblem }],
    });
  }

  let created: { id: string };
  try {
    created = await createRetentionExemption({
      organizationId: access.organizationId,
      surveyId: survey.id,
      entity: body.policy,
      until: body.until,
      reason: body.reason,
      createdById: access.userId,
      now,
    });
  } catch (error) {
    if (error instanceof RetentionExemptionExistsError) {
      return problemUnprocessableContent(requestId, error.message, {
        instance,
        code: "retention_exemption_exists",
      });
    }
    throw error;
  }

  const exemption = await findRetentionExemption({
    id: created.id,
    organizationId: access.organizationId,
    scope: { kind: "organization" },
  });
  if (!exemption) throw new Error("A created retention exemption could not be read back");

  if (auditLog) {
    auditLog.targetId = exemption.id;
    auditLog.newObject = {
      surveyId: exemption.surveyId,
      policy: exemption.entity,
      until: exemption.until.toISOString(),
      reason: exemption.reason,
    };
  }

  return createdResponse(serializeRetentionExemption(exemption), {
    location: `${EXEMPTIONS_PATH}/${exemption.id}`,
    requestId,
  });
}

/** End an active exemption now. The row stays, for history. Owners and managers only. */
export async function revokeRetentionExemptionOperation({
  authentication,
  exemptionId,
  requestId,
  instance,
  auditLog,
}: TRequestContext & { exemptionId: string; auditLog?: TV3AuditLog }): Promise<Response> {
  if (auditLog) auditLog.targetId = exemptionId;

  const organizationId = await getRetentionExemptionOrganizationId(exemptionId);
  if (!organizationId) return problemForbidden(requestId, undefined, instance);

  const access = await requireRetentionOrgAccess({
    authentication,
    organizationId,
    action: "organization.manage",
    requestId,
    instance,
  });
  if (access instanceof Response) return access;
  if (auditLog) auditLog.organizationId = access.organizationId;

  // Read first: the audit entry has to say which survey and policy were un-exempted, and the row goes
  // with its survey if that is deleted later.
  const exemption = await findRetentionExemption({
    id: exemptionId,
    organizationId: access.organizationId,
    scope: { kind: "organization" },
  });
  // Gone since the lookup (its survey was deleted): the same answer as one that never existed.
  if (!exemption) return problemForbidden(requestId, undefined, instance);
  if (auditLog) {
    auditLog.oldObject = {
      surveyId: exemption.surveyId,
      policy: exemption.entity,
      until: exemption.until.toISOString(),
      reason: exemption.reason,
      revokedAt: exemption.revokedAt?.toISOString() ?? null,
    };
  }

  // The database's clock: an exemption's start and end are compared with notice times it stamps.
  const now = await readDatabaseClock(prisma);
  const revoked = await revokeRetentionExemption({ id: exemptionId, revokedById: access.userId, now });
  if (!revoked) {
    return problemUnprocessableContent(requestId, "This exemption has already ended or been revoked.", {
      instance,
      code: "retention_exemption_not_active",
    });
  }

  if (auditLog)
    auditLog.newObject = { ...auditLog.oldObject, revokedAt: now.toISOString(), revokedById: access.userId };

  return successResponse(serializeRetentionExemption({ ...exemption, revokedAt: now }), { requestId });
}

/** Surveys to offer in the Add exemption picker. Owners and managers only, like creating one. */
export async function listRetentionExemptionSurveyOptionsOperation({
  authentication,
  query,
  requestId,
  instance,
}: TRequestContext & { query: TRetentionExemptionSurveyOptionsQuery }): Promise<Response> {
  const access = await requireRetentionOrgAccess({
    authentication,
    organizationId: query.organizationId,
    action: "organization.manage",
    requestId,
    instance,
  });
  if (access instanceof Response) return access;

  const surveys = await searchRetentionExemptionSurveys({
    organizationId: access.organizationId,
    search: query.search,
    limit: query.limit,
  });
  return successResponse(surveys, { requestId });
}
