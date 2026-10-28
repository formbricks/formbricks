import "server-only";
import { logger } from "@formbricks/logger";
import { InvalidInputError } from "@formbricks/types/errors";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { computeFilterFingerprint, decodeKeysetCursor } from "@/app/api/v3/lib/keyset-cursor";
import {
  createdResponse,
  problemBadRequest,
  problemForbidden,
  successListResponse,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { formatAttributeMessage, updateAttributes } from "@/modules/ee/contacts/lib/attributes";
import { deleteContact } from "@/modules/ee/contacts/lib/contacts";
import { requireV3ContactsAccess } from "./access";
import type {
  TV3ContactCountQuery,
  TV3ContactListQuery,
  TV3PatchContactBody,
  TV3UpsertContactBody,
} from "./schemas";
import { serializeV3Contact } from "./serializers";
import {
  CONTACT_LIST_KIND,
  CONTACT_LIST_SORT,
  countContactRows,
  createContactWithUserId,
  findContactIdByUserId,
  getContactRow,
  listContactRows,
  removeContactAttributes,
} from "./service";

type TBaseParams = {
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
};

type TMutationParams = TBaseParams & { auditLog?: TV3AuditLog };

/** A caller cannot tell an unknown contact from another tenant's: both are this answer. */
const forbiddenResource = ({ requestId, instance }: TBaseParams) =>
  problemForbidden(requestId, "You are not authorized to access this resource", instance);

/**
 * Contacts hold respondent personal data, so every operation here derives the workspace from the caller's
 * authorization (a `workspaceId` they were granted, or the one a contact row belongs to) and never from a
 * value that is only checked afterwards. Operations return a `Response` and never throw: MCP calls them
 * without the route wrapper.
 */
const guarded = async (
  params: TBaseParams,
  operation: string,
  run: () => Promise<Response>
): Promise<Response> => {
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

const filterFingerprint = (workspaceId: string, query: TV3ContactCountQuery) =>
  computeFilterFingerprint({
    workspaceId,
    userId: query.userId,
    attributeKey: query.attributeKey,
    attributeValue: query.attributeValue,
  });

export function listV3Contacts(params: TBaseParams & { query: TV3ContactListQuery }): Promise<Response> {
  const { authentication, query, requestId, instance } = params;

  return guarded(params, "contacts.list", async () => {
    const access = await requireV3ContactsAccess({
      authentication,
      workspaceId: query.workspaceId,
      minPermission: "read",
      requestId,
      instance,
    });
    if (access instanceof Response) return access;

    const filters = {
      workspaceId: access.workspaceId,
      userId: query.userId,
      attributeKey: query.attributeKey,
      attributeValue: query.attributeValue,
    };
    const fingerprint = filterFingerprint(access.workspaceId, query);

    // After authorization, so a cursor can never be used to learn anything about a workspace the caller
    // cannot read.
    let cursor = null;
    if (query.cursor) {
      try {
        cursor = decodeKeysetCursor(query.cursor, {
          kind: CONTACT_LIST_KIND,
          sortBy: CONTACT_LIST_SORT,
          fp: fingerprint,
        });
      } catch (err) {
        if (!(err instanceof InvalidInputError)) throw err;
        return problemBadRequest(requestId, err.message, {
          instance,
          invalid_params: [{ name: "cursor", reason: err.message }],
        });
      }
    }

    const { page, nextCursor } = await listContactRows({ filters, limit: query.limit, cursor, fingerprint });

    return successListResponse(
      page.map(serializeV3Contact),
      { limit: query.limit, nextCursor },
      { requestId }
    );
  });
}

export function countV3Contacts(params: TBaseParams & { query: TV3ContactCountQuery }): Promise<Response> {
  const { authentication, query, requestId, instance } = params;

  return guarded(params, "contacts.count", async () => {
    const access = await requireV3ContactsAccess({
      authentication,
      workspaceId: query.workspaceId,
      minPermission: "read",
      requestId,
      instance,
    });
    if (access instanceof Response) return access;

    const count = await countContactRows({
      workspaceId: access.workspaceId,
      userId: query.userId,
      attributeKey: query.attributeKey,
      attributeValue: query.attributeValue,
    });

    return successResponse({ count }, { requestId });
  });
}

export function getV3Contact(params: TBaseParams & { contactId: string }): Promise<Response> {
  const { authentication, contactId, requestId, instance } = params;

  return guarded(params, "contacts.get", async () => {
    const row = await getContactRow(contactId);
    if (!row) return forbiddenResource(params);

    const access = await requireV3ContactsAccess({
      authentication,
      workspaceId: row.workspaceId,
      minPermission: "read",
      requestId,
      instance,
    });
    if (access instanceof Response) return access;

    return successResponse(serializeV3Contact(row), { requestId });
  });
}

/** What `updateAttributes` skipped or did on its own, in the words an agent can act on. */
const toWarnings = (result: Awaited<ReturnType<typeof updateAttributes>>): string[] =>
  [...(result.messages ?? []), ...(result.errors ?? [])].map(formatAttributeMessage);

const withWarnings = (warnings: string[]) => (warnings.length > 0 ? { warnings } : undefined);

export function upsertV3Contact(params: TMutationParams & { body: TV3UpsertContactBody }): Promise<Response> {
  const { authentication, body, auditLog, requestId, instance } = params;

  return guarded(params, "contacts.upsert", async () => {
    const access = await requireV3ContactsAccess({
      authentication,
      workspaceId: body.workspaceId,
      minPermission: "readWrite",
      requestId,
      instance,
    });
    if (access instanceof Response) return access;

    if (auditLog) auditLog.organizationId = access.organizationId;

    const existingId = await findContactIdByUserId(access.workspaceId, body.userId);
    const before = existingId ? await getContactRow(existingId) : null;
    const contactId = existingId ?? (await createContactWithUserId(access.workspaceId, body.userId)).id;
    const created = existingId === null;

    if (auditLog) {
      auditLog.targetId = contactId;
      if (before) auditLog.oldObject = serializeV3Contact(before);
    }

    let warnings: string[] = [];
    if (body.attributes && Object.keys(body.attributes).length > 0) {
      warnings = toWarnings(
        await updateAttributes(contactId, body.userId, access.workspaceId, body.attributes)
      );
    }

    const after = await getContactRow(contactId);
    if (!after) throw new Error("Contact missing right after it was written");

    const data = serializeV3Contact(after);
    if (auditLog) auditLog.newObject = data;

    const extensions = withWarnings(warnings);
    return created
      ? createdResponse(data, { location: `/api/v3/contacts/${contactId}`, requestId, extensions })
      : successResponse(data, { requestId, extensions });
  });
}

export function updateV3Contact(
  params: TMutationParams & { contactId: string; body: TV3PatchContactBody }
): Promise<Response> {
  const { authentication, contactId, body, auditLog, requestId, instance } = params;

  return guarded(params, "contacts.update", async () => {
    const before = await getContactRow(contactId);
    if (!before) return forbiddenResource(params);

    const access = await requireV3ContactsAccess({
      authentication,
      workspaceId: before.workspaceId,
      minPermission: "readWrite",
      requestId,
      instance,
    });
    if (access instanceof Response) return access;

    if (auditLog) {
      auditLog.organizationId = access.organizationId;
      auditLog.targetId = contactId;
      auditLog.oldObject = serializeV3Contact(before);
    }

    if (body.removeAttributeKeys) {
      await removeContactAttributes(contactId, access.workspaceId, body.removeAttributeKeys);
    }

    let warnings: string[] = [];
    if (body.attributes && Object.keys(body.attributes).length > 0) {
      warnings = toWarnings(
        await updateAttributes(
          contactId,
          String(body.attributes.userId ?? ""),
          access.workspaceId,
          body.attributes
        )
      );
    }

    const after = await getContactRow(contactId);
    if (!after) throw new Error("Contact missing right after it was written");

    const data = serializeV3Contact(after);
    if (auditLog) auditLog.newObject = data;

    return successResponse(data, { requestId, extensions: withWarnings(warnings) });
  });
}

export function deleteV3Contact(params: TMutationParams & { contactId: string }): Promise<Response> {
  const { authentication, contactId, auditLog, requestId, instance } = params;

  return guarded(params, "contacts.delete", async () => {
    const before = await getContactRow(contactId);
    if (!before) return forbiddenResource(params);

    const access = await requireV3ContactsAccess({
      authentication,
      workspaceId: before.workspaceId,
      minPermission: "readWrite",
      requestId,
      instance,
    });
    if (access instanceof Response) return access;

    if (auditLog) {
      auditLog.organizationId = access.organizationId;
      auditLog.targetId = contactId;
      auditLog.oldObject = serializeV3Contact(before);
    }

    // Cascades: the contact's attributes, displays and responses go with it.
    await deleteContact(contactId);

    return successResponse({ id: contactId }, { requestId });
  });
}
