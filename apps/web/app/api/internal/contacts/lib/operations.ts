import "server-only";
import { prisma } from "@formbricks/database";
import { ValidationError } from "@formbricks/types/errors";
import { forbidOnRefusal, refusalResponse } from "@/app/api/internal/lib/refusal";
import type { TRequestContext } from "@/app/api/internal/lib/types";
import { requireWorkspaceActionAccess } from "@/app/api/internal/lib/workspace-access";
import { applyRateLimitOrRespond } from "@/app/api/v3/lib/operation-rate-limit";
import {
  noContentResponse,
  problemForbidden,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import { can } from "@/lib/authorization";
import { capturePostHogEvent } from "@/lib/posthog";
import { getOrganizationIdFromWorkspaceId, getWorkspaceIdFromSurveyId } from "@/lib/utils/helper";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { CONTACT_IN_SHARED_DIRECTORY_ERROR_CODE } from "@/modules/ee/contacts/lib/contact-delete-errors";
import {
  ContactDirectoryMissingError,
  requireWorkspaceContactDirectory,
} from "@/modules/ee/contacts/lib/contact-directory";
import { getContactSurveyLink } from "@/modules/ee/contacts/lib/contact-survey-link";
import {
  ContactInSharedDirectoryError,
  deleteContactInWorkspace,
  getContactInWorkspace,
} from "@/modules/ee/contacts/lib/contacts";
import { createContactsFromCSV } from "@/modules/ee/contacts/lib/contacts-csv-upload";
import { ensureContactsEnabled } from "@/modules/ee/contacts/lib/contacts-entitlement";
import { CONTACT_SURVEY_WORKSPACE_MISMATCH_ERROR_CODE } from "@/modules/ee/contacts/lib/personal-link-errors";
import { updateContactAttributes } from "@/modules/ee/contacts/lib/update-contact-attributes";
import type { TContactAttributesBody, TContactImportBody, TContactPersonalLinkBody } from "../schemas";
import {
  type TContactAttributesResource,
  type TContactPersonalLinkResource,
  serializeContactImport,
} from "../serializers";

/**
 * Contact writes, for the contact page, the contacts table and its CSV import. Every operation authorizes a
 * write in a workspace (`workspace.write`) — the one the page acts from, the survey's for a personal link, or
 * the import's — charges the workspace's state-mutation budget, then needs the Contacts licence
 * (`ensureContactsEnabled`), in the order of the server actions they replace. Audited on the contact.
 *
 * Contacts belong to a contact directory that several workspaces may share, so the workspace always comes
 * from the request, never from the contact: a contact's own `workspaceId` only records where it was created
 * (and is null once that workspace is gone). The contact must then be in that workspace's directory.
 */

type TContactAccess = { userId: string; organizationId: string; workspaceId: string };

/** A workspace with no contact directory: 403 with the reason, as the caller was authorized. */
const directoryMissingResponse = (error: unknown, { requestId, instance }: TRequestContext) =>
  error instanceof ContactDirectoryMissingError ? problemForbidden(requestId, error.message, instance) : null;

/**
 * Authorize a write on `workspaceId` (an unknown workspace throws `ResourceNotFoundError`: the wrapper's
 * uniform 403), charge its budget, check the Contacts licence (403 "Contacts are not enabled for this
 * organization"), then require the contact in the workspace's directory (the uniform 403 otherwise, the
 * same as a contact that doesn't exist). The contact and its organization go into the audit entry once all
 * passed, as the actions recorded them.
 */
async function requireContactWrite(
  context: TRequestContext,
  contactId: string,
  workspaceId: string
): Promise<Response | TContactAccess> {
  const { authentication, requestId, instance, auditLog } = context;
  const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);

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

  if (!(await getContactInWorkspace(contactId, workspaceId))) {
    return problemForbidden(requestId, undefined, instance);
  }

  if (auditLog) {
    auditLog.organizationId = organizationId;
    auditLog.targetId = contactId;
  }
  return { userId: access.userId, organizationId, workspaceId };
}

/**
 * `DELETE /api/internal/contacts/{contactId}?workspaceId=`: delete a contact of the workspace's directory.
 * Refused (403 with `CONTACT_IN_SHARED_DIRECTORY_ERROR_CODE`, which the page translates) while another
 * workspace uses the directory: the delete would take that workspace's responses and displays with it.
 * Audited as `deleted`, with the contact.
 */
export async function deleteContactOperation({
  contactId,
  workspaceId,
  ...context
}: TRequestContext & { contactId: string; workspaceId: string }): Promise<Response> {
  const { requestId, instance } = context;
  const access = await requireContactWrite(context, contactId, workspaceId);
  if (access instanceof Response) return access;

  let deleted: Awaited<ReturnType<typeof deleteContactInWorkspace>>;
  try {
    deleted = await deleteContactInWorkspace(contactId, workspaceId);
  } catch (error) {
    if (error instanceof ContactInSharedDirectoryError) {
      return problemForbidden(requestId, CONTACT_IN_SHARED_DIRECTORY_ERROR_CODE, instance);
    }
    const refused = refusalResponse(error, requestId, instance);
    if (refused) return refused;
    throw error;
  }

  if (context.auditLog) context.auditLog.oldObject = deleted;
  return noContentResponse({ requestId });
}

/**
 * `PUT /api/internal/contacts/{contactId}/attributes`: replace a contact's attributes with the ones sent;
 * one left out is removed. A value the save can't take (a type mismatch, a taken email) is skipped and
 * named in `messages`, as before. Audited as `updated`, with the attributes as saved.
 */
export async function updateContactAttributesOperation({
  contactId,
  workspaceId,
  body,
  ...context
}: TRequestContext & {
  contactId: string;
  workspaceId: string;
  body: TContactAttributesBody;
}): Promise<Response> {
  const { requestId, instance, auditLog } = context;
  const access = await requireContactWrite(context, contactId, workspaceId);
  if (access instanceof Response) return access;

  // Deleted meanwhile, or moved out of the directory: `ResourceNotFoundError`, the uniform 403.
  let result: Awaited<ReturnType<typeof updateContactAttributes>>;
  try {
    result = await updateContactAttributes(contactId, workspaceId, body.attributes);
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
 * Authorized on the survey's workspace (an unknown survey is the wrapper's uniform 403); the contact must be
 * in that workspace's contact directory (422 with `CONTACT_SURVEY_WORKSPACE_MISMATCH_ERROR_CODE`, which the
 * dialog translates), so a caller cannot mint a link for a contact of another directory, and the caller must
 * be able to write the survey (ENG-3282), since the link writes responses into it. Audited as `created` on
 * the contact with the survey, and captured in PostHog as `personal_link_created`.
 */
export async function createContactPersonalLinkOperation({
  contactId,
  body,
  ...context
}: TRequestContext & { contactId: string; body: TContactPersonalLinkBody }): Promise<Response> {
  const { authentication, requestId, instance, auditLog } = context;
  const workspaceId = await getWorkspaceIdFromSurveyId(body.surveyId);
  const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);

  const access = await requireWorkspaceActionAccess({
    authentication,
    workspaceId,
    action: "workspace.write",
    requestId,
    instance,
  });
  if (access instanceof Response) return access;
  const { userId } = access;

  const limited = await applyRateLimitOrRespond(rateLimitConfigs.actions.stateMutation, workspaceId, {
    requestId,
    instance,
  });
  if (limited) return limited;

  const notLicensed = await forbidOnRefusal(() => ensureContactsEnabled(organizationId), requestId, instance);
  if (notLicensed) return notLicensed;

  if (!(await getContactInWorkspace(contactId, workspaceId))) {
    return problemUnprocessableContent(requestId, CONTACT_SURVEY_WORKSPACE_MISMATCH_ERROR_CODE, { instance });
  }
  if (auditLog) {
    auditLog.organizationId = organizationId;
    auditLog.targetId = contactId;
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

/**
 * `POST /api/internal/contacts/imports?workspaceId=`: create or update the workspace's contacts from a CSV
 * import, in the order of the server action it replaces: the workspace's organization (an unknown workspace
 * throws `ResourceNotFoundError`, the wrapper's uniform 403), a write on the workspace (`workspace.write`),
 * the workspace's state-mutation budget, then the Contacts licence.
 *
 * Values that don't fit an existing attribute's type answer 200 with `validationErrors` and write nothing,
 * as the action returned them. A refusal from the import itself — a new column that isn't a safe identifier
 * or is reserved, or new keys past `MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT` — is a `ValidationError` raised
 * before anything is written, answered 422 with its message, which the dialog shows.
 *
 * Audited as `createdFromCSV` on `contact` with the contacts written, and captured in PostHog as
 * `contact_created` (`creation_method: "import"`), only when contacts were written.
 */
export async function createContactImportOperation({
  workspaceId,
  body,
  ...context
}: TRequestContext & { workspaceId: string; body: TContactImportBody }): Promise<Response> {
  const { authentication, requestId, instance, auditLog } = context;
  const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);
  // The action's audit entry named the workspace's organization whatever the outcome.
  if (auditLog) auditLog.organizationId = organizationId;

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

  let result: Awaited<ReturnType<typeof createContactsFromCSV>>;
  let existingContactCount: number;
  try {
    // Before any write: a workspace with no directory gets the decision 13 message and nothing is created.
    const directory = await requireWorkspaceContactDirectory(workspaceId);
    existingContactCount = await prisma.contact.count({ where: { directoryId: directory.id } });
    // The identity column (the directory's matching key) is checked here, once the directory is known.
    result = await createContactsFromCSV(
      body.csvData,
      workspaceId,
      directory,
      body.duplicateContactsAction,
      body.attributeMap
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return problemUnprocessableContent(requestId, error.message, { instance });
    }
    const missing = directoryMissingResponse(error, context);
    if (missing) return missing;
    throw error;
  }

  if ("contacts" in result) {
    if (auditLog) auditLog.newObject = { contacts: result.contacts };

    capturePostHogEvent(
      access.userId,
      "contact_created",
      {
        organization_id: organizationId,
        workspace_id: workspaceId,
        existing_contact_count: existingContactCount,
        creation_method: "import",
        import_count: result.contacts.length,
      },
      { organizationId, workspaceId }
    );
  }

  return successResponse(serializeContactImport(result), { requestId });
}
