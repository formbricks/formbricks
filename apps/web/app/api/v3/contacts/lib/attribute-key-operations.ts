import "server-only";
import { logger } from "@formbricks/logger";
import { InvalidInputError } from "@formbricks/types/errors";
import { serializeV3ContactAttributeKey } from "@/app/api/v3/contact-attribute-keys/serializers";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import {
  createdResponse,
  problemConflict,
  problemForbidden,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import {
  createContactAttributeKey,
  deleteContactAttributeKey,
  getContactAttributeKeyById,
  getContactAttributeKeys,
  updateContactAttributeKey,
} from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { requireV3ContactsAccess } from "./access";
import {
  TV3CreateContactAttributeKeyBody,
  TV3PatchContactAttributeKeyBody,
  V3_CONTACT_MAX_ATTRIBUTES,
} from "./schemas";

/**
 * Create, rename and delete workspace contact attribute keys. Reading them is
 * `GET /api/v3/contact-attribute-keys`; these live under `/contacts` because they are the contacts
 * feature's write side and carry its entitlement and scope.
 */
type TBaseParams = {
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
  auditLog?: TV3AuditLog;
};

const DEFAULT_KEY_REFUSAL = "Default attribute keys cannot be changed or deleted";

const guarded = async (params: TBaseParams, operation: string, run: () => Promise<Response>) => {
  try {
    return await run();
  } catch (err) {
    return mapV3ThrownError(err, {
      log: logger.withContext({ requestId: params.requestId }),
      requestId: params.requestId,
      instance: params.instance,
      operation,
    });
  }
};

/**
 * The key's workspace comes from the key row, never from the request. An unknown key answers 403, like
 * every other id-addressed v3 resource, so ids cannot be probed.
 */
async function authorizeKeyMutation(params: TBaseParams, attributeKeyId: string) {
  const { authentication, requestId, instance, auditLog } = params;

  const existing = await getContactAttributeKeyById(attributeKeyId);
  if (!existing) {
    return problemForbidden(requestId, "You are not authorized to access this resource", instance);
  }

  const access = await requireV3ContactsAccess({
    authentication,
    workspaceId: existing.workspaceId,
    minPermission: "readWrite",
    requestId,
    instance,
  });
  if (access instanceof Response) return access;

  if (auditLog) {
    auditLog.organizationId = access.organizationId;
    auditLog.targetId = attributeKeyId;
    auditLog.oldObject = existing;
  }

  // `updateContactAttributeKey` and `deleteContactAttributeKey` refuse these too, but with an error the
  // shared mapper can only render as an unexplained 403.
  if (existing.type === "default") {
    return problemUnprocessableContent(requestId, DEFAULT_KEY_REFUSAL, {
      instance,
      invalid_params: [{ name: "attributeKeyId", reason: DEFAULT_KEY_REFUSAL }],
    });
  }

  return { existing };
}

export function createV3ContactAttributeKey(
  params: TBaseParams & { body: TV3CreateContactAttributeKeyBody }
): Promise<Response> {
  const { authentication, body, auditLog, requestId, instance } = params;

  return guarded(params, "contact-attribute-keys.create", async () => {
    const access = await requireV3ContactsAccess({
      authentication,
      workspaceId: body.workspaceId,
      minPermission: "readWrite",
      requestId,
      instance,
    });
    if (access instanceof Response) return access;

    if (auditLog) auditLog.organizationId = access.organizationId;

    const keys = await getContactAttributeKeys(access.workspaceId);
    if (keys.some((existing) => existing.key === body.key)) {
      return problemConflict(requestId, "An attribute key with this name already exists", instance);
    }
    // The ceiling the SDK and import paths already enforce when they create keys implicitly.
    if (keys.length >= V3_CONTACT_MAX_ATTRIBUTES) {
      return problemUnprocessableContent(
        requestId,
        `A workspace can have at most ${V3_CONTACT_MAX_ATTRIBUTES} attribute keys`,
        { instance }
      );
    }

    let created;
    try {
      created = await createContactAttributeKey({
        workspaceId: access.workspaceId,
        key: body.key,
        name: body.name,
        description: body.description,
        dataType: body.dataType,
      });
    } catch (err) {
      // The service reports a lost race on the (key, workspace) unique index as InvalidInputError.
      if (err instanceof InvalidInputError) {
        return problemConflict(requestId, "An attribute key with this name already exists", instance);
      }
      throw err;
    }

    if (auditLog) {
      auditLog.targetId = created.id;
      auditLog.newObject = created;
    }

    return createdResponse(serializeV3ContactAttributeKey(created), {
      location: `/api/v3/contacts/attribute-keys/${created.id}`,
      requestId,
    });
  });
}

export function updateV3ContactAttributeKey(
  params: TBaseParams & { attributeKeyId: string; body: TV3PatchContactAttributeKeyBody }
): Promise<Response> {
  const { attributeKeyId, body, auditLog, requestId } = params;

  return guarded(params, "contact-attribute-keys.update", async () => {
    const authorized = await authorizeKeyMutation(params, attributeKeyId);
    if (authorized instanceof Response) return authorized;

    const updated = await updateContactAttributeKey(attributeKeyId, {
      name: body.name,
      description: body.description,
    });

    if (auditLog) auditLog.newObject = updated;

    return successResponse(serializeV3ContactAttributeKey(updated), { requestId });
  });
}

export function deleteV3ContactAttributeKey(
  params: TBaseParams & { attributeKeyId: string }
): Promise<Response> {
  const { attributeKeyId, requestId } = params;

  return guarded(params, "contact-attribute-keys.delete", async () => {
    const authorized = await authorizeKeyMutation(params, attributeKeyId);
    if (authorized instanceof Response) return authorized;

    // Cascades: every contact's value for this attribute goes with the key.
    await deleteContactAttributeKey(attributeKeyId);

    return successResponse({ id: attributeKeyId }, { requestId });
  });
}
