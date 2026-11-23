import "server-only";
import { logger } from "@formbricks/logger";
import {
  type TV3OrganizationAccessLevel,
  requireV3OrganizationAccess,
} from "@/app/api/v3/lib/organization-access";
import {
  createdResponse,
  problemBadRequest,
  problemConflict,
  problemForbidden,
  problemMemberAttributeKeyInUse,
  problemMemberAttributesPlanRequired,
  problemUnprocessableContent,
  successListResponse,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { getIsDashboardViewerRoleEnabled } from "@/modules/ee/license-check/lib/utils";
import { planBulkMemberAttributeRows } from "@/modules/ee/member-attributes/lib/bulk";
import {
  MemberAttributeKeyConflictError,
  MemberAttributeKeyInUseError,
  MemberAttributeKeyLimitError,
  MemberAttributeKeyNotFoundError,
  MemberAttributeKeyTakenError,
} from "@/modules/ee/member-attributes/lib/errors";
import { MEMBER_ATTRIBUTE_LIST_DEFAULT_LIMIT } from "@/modules/ee/member-attributes/lib/limits";
import {
  applyMemberAttributeWrites,
  createAttributeKey,
  deleteAttributeKey,
  getAttributeKey,
  listAttributeKeys,
  listAttributeKeysWithUsage,
  listMemberAttributeRows,
  matchEmailsInOrganization,
  updateAttributeKey,
} from "@/modules/ee/member-attributes/lib/service";
import type { TV3BulkMemberAttributesBody } from "./schemas";
import {
  decodeMemberAttributeRowsCursor,
  encodeMemberAttributeRowsCursor,
  serializeMemberAttributeKey,
  serializeMemberAttributeKeyListItem,
} from "./serializers";

/**
 * v3 Member attribute operations (ENG-7473). Each returns a `Response` for every outcome and never
 * throws on caller input, so the MCP read tools call them without the route wrapper.
 *
 * Access: `requireV3OrganizationAccess` (Owners and Managers, or an API key with Access Control read /
 * write), then the plan gate. Member attributes exist for Dashboard Viewer access, so they need what the
 * Dashboard Viewer role needs: Access Control and Dashboards (`getIsDashboardViewerRoleEnabled`) — the one
 * gate every entry point runs: the v3 routes here, the MCP read tools (through these operations) and the
 * Members page (which reads through these routes).
 */

type TBaseParams = {
  authentication: TV3Authentication;
  organizationId: string;
  requestId: string;
  instance?: string;
};

const FORBIDDEN_DETAIL = "You are not authorized to access this resource";

export async function authorizeMemberAttributes(
  { authentication, organizationId, requestId, instance }: TBaseParams,
  level: TV3OrganizationAccessLevel
): Promise<Response | { organizationId: string }> {
  const access = await requireV3OrganizationAccess(
    authentication,
    organizationId,
    level,
    requestId,
    instance
  );
  if (access instanceof Response) return access;
  if (!(await getIsDashboardViewerRoleEnabled(access.organizationId))) {
    return problemMemberAttributesPlanRequired(requestId, instance);
  }
  return access;
}

// ---------------------------------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------------------------------

export async function listV3MemberAttributeKeys(params: TBaseParams): Promise<Response> {
  const access = await authorizeMemberAttributes(params, "read");
  if (access instanceof Response) return access;

  const keys = await listAttributeKeysWithUsage(access.organizationId);
  return successResponse(keys.map(serializeMemberAttributeKeyListItem), { requestId: params.requestId });
}

export async function getV3MemberAttributeKey(params: TBaseParams & { keyId: string }): Promise<Response> {
  const access = await authorizeMemberAttributes(params, "read");
  if (access instanceof Response) return access;

  const key = await getAttributeKey(access.organizationId, params.keyId);
  if (!key) return problemForbidden(params.requestId, FORBIDDEN_DETAIL, params.instance);
  return successResponse(serializeMemberAttributeKey(key), { requestId: params.requestId });
}

export async function createV3MemberAttributeKey(
  params: TBaseParams & {
    body: { key: string; label: string; description: string | null };
    auditLog?: TV3AuditLog;
  }
): Promise<Response> {
  const { requestId, instance, auditLog } = params;
  const access = await authorizeMemberAttributes(params, "write");
  if (access instanceof Response) return access;
  if (auditLog) auditLog.organizationId = access.organizationId;

  try {
    const key = await createAttributeKey(access.organizationId, params.body);
    if (auditLog) {
      auditLog.targetId = key.id;
      auditLog.newObject = key;
    }
    return createdResponse(serializeMemberAttributeKey(key), {
      requestId,
      location: `/api/v3/organizations/${access.organizationId}/member-attribute-keys/${key.id}`,
    });
  } catch (error) {
    if (error instanceof MemberAttributeKeyTakenError) {
      return problemConflict(requestId, "A Member attribute with this key already exists", instance);
    }
    if (error instanceof MemberAttributeKeyLimitError) {
      return problemUnprocessableContent(requestId, error.message, {
        instance,
        invalid_params: [
          {
            name: "key",
            reason: `an organization can have at most ${error.limit} Member attributes`,
            code: "limit_exceeded",
          },
        ],
      });
    }
    throw error;
  }
}

const conflictResponse = (requestId: string, instance: string | undefined, currentUpdatedAt: Date) =>
  problemConflict(requestId, "The Member attribute changed since it was read", instance, {
    details: { currentUpdatedAt: currentUpdatedAt.toISOString() },
  });

export async function updateV3MemberAttributeKey(
  params: TBaseParams & {
    keyId: string;
    body: { label?: string; description?: string | null; expectedUpdatedAt: string };
    auditLog?: TV3AuditLog;
  }
): Promise<Response> {
  const { requestId, instance, auditLog, keyId, body } = params;
  const access = await authorizeMemberAttributes(params, "write");
  if (access instanceof Response) return access;
  if (auditLog) {
    auditLog.organizationId = access.organizationId;
    auditLog.targetId = keyId;
  }

  try {
    const { before, after } = await updateAttributeKey(access.organizationId, keyId, {
      label: body.label,
      description: body.description,
      expectedUpdatedAt: new Date(body.expectedUpdatedAt),
    });
    if (auditLog) {
      auditLog.oldObject = before;
      auditLog.newObject = after;
    }
    return successResponse(serializeMemberAttributeKey(after), { requestId });
  } catch (error) {
    if (error instanceof MemberAttributeKeyNotFoundError) {
      return problemForbidden(requestId, FORBIDDEN_DETAIL, instance);
    }
    if (error instanceof MemberAttributeKeyConflictError) {
      return conflictResponse(requestId, instance, error.currentUpdatedAt);
    }
    throw error;
  }
}

export async function deleteV3MemberAttributeKey(
  params: TBaseParams & { keyId: string; expectedUpdatedAt?: string; auditLog?: TV3AuditLog }
): Promise<Response> {
  const { requestId, instance, auditLog, keyId } = params;
  const access = await authorizeMemberAttributes(params, "write");
  if (access instanceof Response) return access;
  if (auditLog) {
    auditLog.organizationId = access.organizationId;
    auditLog.targetId = keyId;
  }

  try {
    const deleted = await deleteAttributeKey(
      access.organizationId,
      keyId,
      params.expectedUpdatedAt ? new Date(params.expectedUpdatedAt) : undefined
    );
    if (auditLog) auditLog.oldObject = deleted;
    return successResponse({ id: deleted.id }, { requestId });
  } catch (error) {
    if (error instanceof MemberAttributeKeyNotFoundError) {
      return problemForbidden(requestId, FORBIDDEN_DETAIL, instance);
    }
    if (error instanceof MemberAttributeKeyConflictError) {
      return conflictResponse(requestId, instance, error.currentUpdatedAt);
    }
    if (error instanceof MemberAttributeKeyInUseError) {
      return problemMemberAttributeKeyInUse(requestId, error.datasets, error.datasetCount, instance);
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------------------------------

export async function listV3MemberAttributes(
  params: TBaseParams & { query: { limit?: number; cursor?: string; search?: string } }
): Promise<Response> {
  const { requestId, instance, query } = params;
  const access = await authorizeMemberAttributes(params, "read");
  if (access instanceof Response) return access;

  const cursor = query.cursor ? decodeMemberAttributeRowsCursor(query.cursor) : null;
  if (query.cursor && !cursor) {
    return problemBadRequest(requestId, "Invalid cursor", {
      instance,
      invalid_params: [{ name: "cursor", reason: "is not a cursor this list returned" }],
    });
  }

  const limit = query.limit ?? MEMBER_ATTRIBUTE_LIST_DEFAULT_LIMIT;
  const { rows, nextCursor } = await listMemberAttributeRows(access.organizationId, {
    limit,
    cursor,
    search: query.search,
  });

  return successListResponse(
    rows,
    { limit, nextCursor: nextCursor ? encodeMemberAttributeRowsCursor(nextCursor) : null },
    { requestId }
  );
}

/**
 * Sets members' and pending invites' values, matched by email, in one transaction. Per row: a member's
 * values are replaced for the keys the row names; failing that, every pending invite to the email; an
 * email naming neither is reported, as is a row refused for an unknown key or a value past a cap. The
 * batch is one audit event carrying each row's outcome (never the values themselves).
 */
export async function bulkSetV3MemberAttributes(
  params: TBaseParams & { body: TV3BulkMemberAttributesBody; auditLog?: TV3AuditLog }
): Promise<Response> {
  const { requestId, auditLog, body } = params;
  const access = await authorizeMemberAttributes(params, "write");
  if (access instanceof Response) return access;
  if (auditLog) {
    auditLog.organizationId = access.organizationId;
    auditLog.targetId = access.organizationId;
  }

  const [keys, matches] = await Promise.all([
    listAttributeKeys(access.organizationId),
    matchEmailsInOrganization(
      access.organizationId,
      body.rows.map((row) => row.email)
    ),
  ]);
  const { outcomes, writes } = planBulkMemberAttributeRows({
    rows: body.rows,
    keyIdByKey: new Map(keys.map((key) => [key.key, key.id])),
    matches,
  });

  await applyMemberAttributeWrites(access.organizationId, writes);

  const summary = {
    updatedMembers: outcomes.filter((outcome) => outcome.status === "updated_member").length,
    updatedInvites: outcomes.filter((outcome) => outcome.status === "updated_invite").length,
    unknownEmails: outcomes.filter((outcome) => outcome.status === "unknown_email").length,
    invalid: outcomes.filter((outcome) => outcome.status === "invalid").length,
  };

  if (auditLog) {
    auditLog.newObject = {
      summary,
      rows: outcomes.map((outcome) => ({
        email: outcome.email,
        status: outcome.status,
        keys: Object.keys(body.rows[outcome.index].attributes),
      })),
    };
  }
  logger
    .withContext({ requestId, organizationId: access.organizationId })
    .info({ summary }, "Member attributes set");

  return successResponse({ summary, rows: outcomes }, { requestId });
}
