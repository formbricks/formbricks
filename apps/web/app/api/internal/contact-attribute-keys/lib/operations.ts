import "server-only";
import type { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { InvalidInputError, OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { forbidOnRefusal } from "@/app/api/internal/lib/refusal";
import { getV3SessionUserId, requireSessionWorkspaceAccess } from "@/app/api/v3/lib/auth";
import { applyRateLimitOrRespond } from "@/app/api/v3/lib/operation-rate-limit";
import {
  noContentResponse,
  problemForbidden,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { capturePostHogEvent } from "@/lib/posthog";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import {
  createContactAttributeKey,
  deleteContactAttributeKey,
  getContactAttributeKeyById,
  updateContactAttributeKey,
} from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { ensureContactsEnabled } from "@/modules/ee/contacts/lib/contacts-entitlement";
import type { TCreateContactAttributeKeyBody, TUpdateContactAttributeKeyBody } from "../schemas";
import { serializeContactAttributeKey } from "../serializers";

/**
 * Contact attribute keys, for the attributes page. Every write needs write access to the key's workspace
 * (`workspace.write`), is charged to the workspace's state-mutation budget, and then needs the Contacts
 * licence (`ensureContactsEnabled`, the gate every contacts write shares), in the server actions' order.
 * Audited on the key, as the actions were.
 */

type TRequestContext = {
  authentication: TV3Authentication;
  requestId: string;
  instance?: string;
  auditLog?: TV3AuditLog;
};

/**
 * Authorize a write in the workspace, charge its budget, then check the Contacts licence. The organization
 * goes into the audit entry once the workspace is authorized.
 */
async function requireContactsWrite(
  { authentication, requestId, instance, auditLog }: TRequestContext,
  workspaceId: string
): Promise<Response | { organizationId: string; workspaceId: string }> {
  const access = await requireSessionWorkspaceAccess(
    authentication,
    workspaceId,
    "readWrite",
    requestId,
    instance
  );
  if (access instanceof Response) return access;
  if (auditLog) auditLog.organizationId = access.organizationId;

  const limited = await applyRateLimitOrRespond(rateLimitConfigs.actions.stateMutation, access.workspaceId, {
    requestId,
    instance,
  });
  if (limited) return limited;

  // "Contacts are not enabled for this organization" where the licence or plan has no contacts.
  const notLicensed = await forbidOnRefusal(
    () => ensureContactsEnabled(access.organizationId),
    requestId,
    instance
  );
  if (notLicensed) return notLicensed;

  return access;
}

/** The key an update or a delete names, as the audit entry records it. */
type TExistingKey = NonNullable<Awaited<ReturnType<typeof getContactAttributeKeyById>>>;

/**
 * The service's refusals on a key: a default key, which can't be changed (403 with the reason, as the
 * caller was authorized), and a key deleted meanwhile (the uniform 403).
 */
const mapKeyWriteError = (error: unknown, { requestId, instance }: TRequestContext): Response => {
  if (error instanceof OperationNotAllowedError) return problemForbidden(requestId, error.message, instance);
  if (error instanceof ResourceNotFoundError) return problemForbidden(requestId, undefined, instance);
  throw error;
};

/**
 * `POST /api/internal/contact-attribute-keys`: add a custom key. A key the workspace already has is a 422
 * with the service's reason. Audited as `created`, with the key, and captured in PostHog as
 * `contact_attribute_key_created`.
 */
export async function createContactAttributeKeyOperation({
  body,
  ...context
}: TRequestContext & { body: TCreateContactAttributeKeyBody }): Promise<Response> {
  const { authentication, requestId, instance, auditLog } = context;
  const access = await requireContactsWrite(context, body.workspaceId);
  if (access instanceof Response) return access;
  const { organizationId, workspaceId } = access;

  let created: TContactAttributeKey;
  try {
    created = await createContactAttributeKey({
      workspaceId,
      key: body.key,
      name: body.name,
      description: body.description,
      dataType: body.dataType,
    });
  } catch (error) {
    if (error instanceof InvalidInputError) {
      return problemUnprocessableContent(requestId, error.message, {
        instance,
        invalid_params: [{ name: "key", reason: error.message }],
      });
    }
    throw error;
  }

  if (auditLog) auditLog.newObject = created;

  capturePostHogEvent(
    getV3SessionUserId(authentication) ?? "",
    "contact_attribute_key_created",
    { organization_id: organizationId, workspace_id: workspaceId, key: body.key },
    { organizationId, workspaceId }
  );

  return successResponse(serializeContactAttributeKey(created), { requestId, status: 201 });
}

/**
 * Find the key, then authorize the write in its own workspace (never one the caller names), with its
 * licence. A key that doesn't exist answers the uniform 403. The key goes into the audit entry as its old
 * object before the write, as the server actions recorded it.
 */
async function requireExistingKeyWrite(
  context: TRequestContext,
  contactAttributeKeyId: string
): Promise<Response | TExistingKey> {
  const { requestId, instance, auditLog } = context;
  const existing = await getContactAttributeKeyById(contactAttributeKeyId);
  if (!existing) return problemForbidden(requestId, undefined, instance);

  const access = await requireContactsWrite(context, existing.workspaceId);
  if (access instanceof Response) return access;

  if (auditLog) auditLog.oldObject = existing;
  return existing;
}

/**
 * `PATCH /api/internal/contact-attribute-keys/{contactAttributeKeyId}`: change a custom key's label and
 * description. Audited as `updated`, from the key as it was to the key as saved.
 */
export async function updateContactAttributeKeyOperation({
  contactAttributeKeyId,
  body,
  ...context
}: TRequestContext & {
  contactAttributeKeyId: string;
  body: TUpdateContactAttributeKeyBody;
}): Promise<Response> {
  const { requestId, auditLog } = context;
  const existing = await requireExistingKeyWrite(context, contactAttributeKeyId);
  if (existing instanceof Response) return existing;

  let updated: TContactAttributeKey;
  try {
    updated = await updateContactAttributeKey(contactAttributeKeyId, {
      name: body.name,
      description: body.description,
    });
  } catch (error) {
    return mapKeyWriteError(error, context);
  }

  if (auditLog) auditLog.newObject = updated;
  return successResponse(serializeContactAttributeKey(updated), { requestId });
}

/**
 * `DELETE /api/internal/contact-attribute-keys/{contactAttributeKeyId}`: delete a custom key.
 * Audited as `deleted`, with the key as it was.
 */
export async function deleteContactAttributeKeyOperation({
  contactAttributeKeyId,
  ...context
}: TRequestContext & { contactAttributeKeyId: string }): Promise<Response> {
  const existing = await requireExistingKeyWrite(context, contactAttributeKeyId);
  if (existing instanceof Response) return existing;

  try {
    await deleteContactAttributeKey(contactAttributeKeyId);
  } catch (error) {
    return mapKeyWriteError(error, context);
  }

  return noContentResponse({ requestId: context.requestId });
}
