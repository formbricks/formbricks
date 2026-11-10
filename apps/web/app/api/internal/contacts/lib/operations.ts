import "server-only";
import { forbidOnRefusal, refusalResponse } from "@/app/api/internal/lib/refusal";
import { requireWorkspaceActionAccess } from "@/app/api/internal/lib/workspace-access";
import { applyRateLimitOrRespond } from "@/app/api/v3/lib/operation-rate-limit";
import {
  noContentResponse,
  problemForbidden,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { can } from "@/lib/authorization";
import { capturePostHogEvent } from "@/lib/posthog";
import {
  getOrganizationIdFromContactId,
  getWorkspaceIdFromContactId,
  getWorkspaceIdFromSurveyId,
} from "@/lib/utils/helper";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { getContactSurveyLink } from "@/modules/ee/contacts/lib/contact-survey-link";
import { deleteContact, getContact } from "@/modules/ee/contacts/lib/contacts";
import { ensureContactsEnabled } from "@/modules/ee/contacts/lib/contacts-entitlement";
import { CONTACT_SURVEY_WORKSPACE_MISMATCH_ERROR_CODE } from "@/modules/ee/contacts/lib/personal-link-errors";
import { updateContactAttributes } from "@/modules/ee/contacts/lib/update-contact-attributes";
import type { TContactAttributesBody, TContactPersonalLinkBody } from "../schemas";
import type { TContactAttributesResource, TContactPersonalLinkResource } from "../serializers";

/**
 * One contact's writes, for the contact page and the contacts table. Every operation authorizes a write in
 * the contact's own workspace (`workspace.write`), charges the workspace's state-mutation budget, then needs
 * the Contacts licence (`ensureContactsEnabled`), in the order of the server actions they replace. Audited
 * on the contact.
 */

type TRequestContext = {
  authentication: TV3Authentication;
  requestId: string;
  instance?: string;
  auditLog?: TV3AuditLog;
};

type TContactAccess = { userId: string; organizationId: string; workspaceId: string };

/**
 * Authorize a write on the contact's workspace, read off the contact (an unknown contact throws
 * `ResourceNotFoundError`: the wrapper's uniform 403), charge its budget, then check the Contacts licence
 * (403 "Contacts are not enabled for this organization"). The contact and its organization go into the
 * audit entry once all three passed, as the actions recorded them.
 */
async function requireContactWrite(
  context: TRequestContext,
  contactId: string
): Promise<Response | TContactAccess> {
  const { authentication, requestId, instance, auditLog } = context;
  const organizationId = await getOrganizationIdFromContactId(contactId);
  const workspaceId = await getWorkspaceIdFromContactId(contactId);

  const access = await requireWorkspaceActionAccess({
    authentication,
    workspaceId,
    action: "workspace.write",
    requestId,
    instance,
  });
  if (access instanceof Response) return access;

  const limited = await applyRateLimitOrRespond(rateLimitConfigs.actions.stateMutation, workspaceId, {
    requestId,
    instance,
  });
  if (limited) return limited;

  const notLicensed = await forbidOnRefusal(() => ensureContactsEnabled(organizationId), requestId, instance);
  if (notLicensed) return notLicensed;

  if (auditLog) {
    auditLog.organizationId = organizationId;
    auditLog.targetId = contactId;
  }
  return { userId: access.userId, organizationId, workspaceId };
}

/** `DELETE /api/internal/contacts/{contactId}`: delete a contact. Audited as `deleted`, with the contact. */
export async function deleteContactOperation({
  contactId,
  ...context
}: TRequestContext & { contactId: string }): Promise<Response> {
  const access = await requireContactWrite(context, contactId);
  if (access instanceof Response) return access;

  const deleted = await deleteContact(contactId);

  if (context.auditLog) context.auditLog.oldObject = deleted;
  return noContentResponse({ requestId: context.requestId });
}

/**
 * `PUT /api/internal/contacts/{contactId}/attributes`: replace a contact's attributes with the ones sent;
 * one left out is removed. A value the save can't take (a type mismatch, a taken email) is skipped and
 * named in `messages`, as before. Audited as `updated`, with the attributes as saved.
 */
export async function updateContactAttributesOperation({
  contactId,
  body,
  ...context
}: TRequestContext & { contactId: string; body: TContactAttributesBody }): Promise<Response> {
  const { requestId, instance, auditLog } = context;
  const access = await requireContactWrite(context, contactId);
  if (access instanceof Response) return access;

  // Deleted meanwhile: the uniform 403.
  const contact = await getContact(contactId);
  if (!contact) return problemForbidden(requestId, undefined, instance);

  let result: Awaited<ReturnType<typeof updateContactAttributes>>;
  try {
    result = await updateContactAttributes(contactId, body.attributes);
  } catch (error) {
    const refused = refusalResponse(error, requestId, instance);
    if (refused) return refused;
    throw error;
  }

  if (auditLog) auditLog.newObject = { contactId, attributes: result.updatedAttributes };

  const resource: TContactAttributesResource = { contactId, messages: result.messages ?? [] };
  return successResponse(resource, { requestId });
}

/**
 * `POST /api/internal/contacts/{contactId}/personal-links`: a personal link to a survey for the contact.
 * Besides the contact's write checks, the survey must be in the contact's workspace (422 with
 * `CONTACT_SURVEY_WORKSPACE_MISMATCH_ERROR_CODE`, which the dialog translates) and the caller must be able
 * to write it (ENG-3282), since the link writes responses into it. Audited as `created` on the contact with
 * the survey, and captured in PostHog as `personal_link_created`.
 */
export async function createContactPersonalLinkOperation({
  contactId,
  body,
  ...context
}: TRequestContext & { contactId: string; body: TContactPersonalLinkBody }): Promise<Response> {
  const { requestId, instance, auditLog } = context;
  const access = await requireContactWrite(context, contactId);
  if (access instanceof Response) return access;
  const { userId, organizationId, workspaceId } = access;

  // Cross-tenant guard: authorization above is derived from the contact only, so a survey from another
  // workspace would otherwise get a working personal link.
  const surveyWorkspaceId = await getWorkspaceIdFromSurveyId(body.surveyId);
  if (surveyWorkspaceId !== workspaceId) {
    return problemUnprocessableContent(requestId, CONTACT_SURVEY_WORKSPACE_MISMATCH_ERROR_CODE, { instance });
  }
  if (!(await can({ type: "user", id: userId }, "survey.write", { type: "survey", id: body.surveyId }))) {
    return problemForbidden(requestId, undefined, instance);
  }

  const result = await getContactSurveyLink(contactId, body.surveyId, body.expirationDays);
  if (!result.ok) {
    if (result.error.type === "not_found") return problemForbidden(requestId, undefined, instance);
    const fallback =
      result.error.type === "bad_request" ? "Invalid request" : "Failed to generate personal survey link";
    return problemUnprocessableContent(requestId, result.error.details?.[0]?.issue || fallback, { instance });
  }

  capturePostHogEvent(
    userId,
    "personal_link_created",
    { organization_id: organizationId, workspace_id: workspaceId, survey_id: body.surveyId },
    { organizationId, workspaceId }
  );

  if (auditLog) auditLog.newObject = { surveyId: body.surveyId };
  const resource: TContactPersonalLinkResource = { surveyUrl: result.data };
  return successResponse(resource, { requestId });
}
