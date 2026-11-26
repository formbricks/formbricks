import "server-only";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import type { TSurveyQuota } from "@formbricks/types/quota";
import { forbidOnRefusal } from "@/app/api/internal/lib/refusal";
import { type TSurveyAction, requireSurveyActionAccess } from "@/app/api/internal/lib/survey-access";
import type { TRequestContext } from "@/app/api/internal/lib/types";
import {
  noContentResponse,
  problemConflict,
  problemForbidden,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import { getOrganizationIdFromSurveyId } from "@/lib/utils/helper";
import { QuotaNameTakenError } from "@/modules/ee/quotas/lib/errors";
import { checkQuotasEnabled } from "@/modules/ee/quotas/lib/permission";
import { getQuotaLinkCountByQuotaId } from "@/modules/ee/quotas/lib/quota-link";
import { createQuota, deleteQuota, getQuota, updateQuota } from "@/modules/ee/quotas/lib/quotas";
import type { TQuotaBody } from "../schemas";
import { type TQuotaResponseCountResource, serializeQuota } from "../serializers";

/**
 * Survey quotas, for the survey editor's quota card. Every operation authorizes the caller on the quota's
 * survey, then checks that the organization's plan or licence includes quotas, as the server actions they
 * replace did. Writes are audited on the quota.
 */

/** A quota the caller may not reach, or that is gone: the uniform 403 either way. */
const findQuota = async (quotaId: string): Promise<TSurveyQuota | null> => {
  try {
    return await getQuota(quotaId);
  } catch (error) {
    if (error instanceof ResourceNotFoundError) return null;
    throw error;
  }
};

/**
 * Authorize `action` on the survey, then the quotas licence. The organization is read off the survey,
 * never taken from the caller, and goes into the audit entry before any check can refuse.
 */
async function requireQuotaSurveyAccess(
  context: TRequestContext,
  surveyId: string,
  action: TSurveyAction
): Promise<Response | { organizationId: string }> {
  const { authentication, requestId, instance, auditLog } = context;
  let organizationId: string;
  try {
    organizationId = await getOrganizationIdFromSurveyId(surveyId);
  } catch (error) {
    if (error instanceof ResourceNotFoundError) return problemForbidden(requestId, undefined, instance);
    throw error;
  }
  if (auditLog) auditLog.organizationId = organizationId;

  const access = await requireSurveyActionAccess({ authentication, surveyId, action, requestId, instance });
  if (access instanceof Response) return access;

  // "Quotas are not enabled" for a plan or licence without them; the uniform 403 for an organization
  // without billing.
  const notLicensed = await forbidOnRefusal(() => checkQuotasEnabled(organizationId), requestId, instance);
  if (notLicensed) return notLicensed;

  return { organizationId };
}

/** Authorize `action` on the quota's survey (see `requireQuotaSurveyAccess`), answering with the quota. */
async function requireQuotaAccess(
  context: TRequestContext,
  quotaId: string,
  action: TSurveyAction
): Promise<Response | TSurveyQuota> {
  const { requestId, instance, auditLog } = context;
  if (auditLog) auditLog.targetId = quotaId;

  const quota = await findQuota(quotaId);
  if (!quota) return problemForbidden(requestId, undefined, instance);

  const access = await requireQuotaSurveyAccess(context, quota.surveyId, action);
  if (access instanceof Response) return access;
  return quota;
}

/**
 * The quota service's refusals: a name another quota on the survey has (409), a condition that points at
 * a matrix row or column the survey doesn't have (422), and a quota deleted meanwhile (the uniform 403).
 */
const mapQuotaWriteError = (error: unknown, { requestId, instance }: TRequestContext): Response => {
  if (error instanceof QuotaNameTakenError) return problemConflict(requestId, error.message, instance);
  if (error instanceof InvalidInputError) {
    return problemUnprocessableContent(requestId, error.message, {
      instance,
      invalid_params: [{ name: "logic", reason: error.message }],
    });
  }
  if (error instanceof ResourceNotFoundError) return problemForbidden(requestId, undefined, instance);
  throw error;
};

/** `POST /api/internal/quotas`: add a quota to a survey, or duplicate one. Audited as `created`. */
export async function createQuotaOperation({
  body,
  ...context
}: TRequestContext & { body: TQuotaBody }): Promise<Response> {
  const { requestId, auditLog } = context;
  const access = await requireQuotaSurveyAccess(context, body.surveyId, "survey.write");
  if (access instanceof Response) return access;

  let quota: TSurveyQuota;
  try {
    quota = await createQuota(body);
  } catch (error) {
    return mapQuotaWriteError(error, context);
  }

  if (auditLog) {
    auditLog.targetId = quota.id;
    auditLog.newObject = quota;
  }
  // No `Location`: the quota's own path answers PUT and DELETE only, and a `Location` should be somewhere
  // the client can read what was created.
  return successResponse(serializeQuota(quota), { requestId, status: 201 });
}

/**
 * `PUT /api/internal/quotas/{quotaId}`: replace a quota's settings. Its survey stays the one it was created
 * on, whatever `surveyId` the body names. Audited as `updated`, with the body as the old object and the
 * saved quota as the new one, as the server action recorded it.
 */
export async function updateQuotaOperation({
  quotaId,
  body,
  ...context
}: TRequestContext & { quotaId: string; body: TQuotaBody }): Promise<Response> {
  const { requestId, auditLog } = context;
  const access = await requireQuotaAccess(context, quotaId, "survey.write");
  if (access instanceof Response) return access;

  let quota: TSurveyQuota;
  try {
    quota = await updateQuota(body, quotaId);
  } catch (error) {
    return mapQuotaWriteError(error, context);
  }

  if (auditLog) {
    auditLog.oldObject = body;
    auditLog.newObject = quota;
  }
  return successResponse(serializeQuota(quota), { requestId });
}

/** `DELETE /api/internal/quotas/{quotaId}`: delete a quota. Audited as `deleted`, with the deleted quota. */
export async function deleteQuotaOperation({
  quotaId,
  ...context
}: TRequestContext & { quotaId: string }): Promise<Response> {
  const { requestId, instance, auditLog } = context;
  const access = await requireQuotaAccess(context, quotaId, "survey.write");
  if (access instanceof Response) return access;

  let deleted: TSurveyQuota;
  try {
    deleted = await deleteQuota(quotaId);
  } catch (error) {
    if (error instanceof ResourceNotFoundError) return problemForbidden(requestId, undefined, instance);
    throw error;
  }

  if (auditLog) auditLog.oldObject = deleted;
  return noContentResponse({ requestId });
}

/**
 * `GET /api/internal/quotas/{quotaId}/response-count`: how many responses the quota has screened in, which
 * the quota modal keeps the limit from going below. A count of the survey's responses, so it asks for
 * `survey.response_read`, not write access.
 */
export async function getQuotaResponseCountOperation({
  quotaId,
  ...context
}: TRequestContext & { quotaId: string }): Promise<Response> {
  const access = await requireQuotaAccess(context, quotaId, "survey.response_read");
  if (access instanceof Response) return access;

  const resource: TQuotaResponseCountResource = { quotaId, count: await getQuotaLinkCountByQuotaId(quotaId) };
  return successResponse(resource, { requestId: context.requestId });
}
