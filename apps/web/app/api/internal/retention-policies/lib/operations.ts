import "server-only";
import { skipV3AuditLog } from "@/app/api/v3/lib/audit";
import { problemUnprocessableContent, successResponse } from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { requireRetentionOrgAccess } from "@/modules/ee/data-retention/lib/api-access";
import {
  RetentionPolicyInvalidError,
  getRetentionPolicyRows,
  resolveRetentionPolicySettings,
  updateRetentionPolicy,
} from "@/modules/ee/data-retention/lib/policies-service";
import type { TRetentionPolicyKind, TRetentionPolicySettings } from "@/modules/ee/data-retention/types";
import type { TRetentionPoliciesPatchBody, TRetentionPoliciesQuery } from "../schemas";
import { serializeRetentionPolicies } from "../serializers";

type TRequestContext = {
  authentication: TV3Authentication;
  query: TRetentionPoliciesQuery;
  requestId: string;
  instance?: string;
};

const readPoliciesDocument = async (organizationId: string) =>
  serializeRetentionPolicies(resolveRetentionPolicySettings(await getRetentionPolicyRows(organizationId)));

/** The three policies. Every member may read them (ENG-3695); a never-saved policy reads as its defaults. */
export async function getRetentionPoliciesOperation({
  authentication,
  query,
  requestId,
  instance,
}: TRequestContext): Promise<Response> {
  const access = await requireRetentionOrgAccess({
    authentication,
    organizationId: query.organizationId,
    action: "organization.read_access",
    requestId,
    instance,
  });
  if (access instanceof Response) return access;

  return successResponse(await readPoliciesDocument(access.organizationId), { requestId });
}

/**
 * Change one policy. Owners and managers only. Returns the whole document, so the client can replace
 * what it holds. A change that leaves the policy as it was is not audited.
 */
export async function updateRetentionPoliciesOperation({
  authentication,
  query,
  body,
  requestId,
  instance,
  auditLog,
}: TRequestContext & { body: TRetentionPoliciesPatchBody; auditLog?: TV3AuditLog }): Promise<Response> {
  // The schema guarantees exactly one policy.
  const [[policy, patch]] = Object.entries(body) as [
    TRetentionPolicyKind,
    Partial<TRetentionPolicySettings>,
  ][];
  // What was asked for, so a refused or invalid attempt is still attributable in the audit log.
  if (auditLog) auditLog.newObject = { organizationId: query.organizationId, policy, ...patch };

  const access = await requireRetentionOrgAccess({
    authentication,
    organizationId: query.organizationId,
    action: "organization.manage",
    requestId,
    instance,
  });
  if (access instanceof Response) return access;
  if (auditLog) auditLog.organizationId = access.organizationId;

  let update;
  try {
    update = await updateRetentionPolicy({
      organizationId: access.organizationId,
      policy,
      patch,
      updatedById: access.userId,
    });
  } catch (error) {
    if (error instanceof RetentionPolicyInvalidError) {
      return problemUnprocessableContent(requestId, "The retention policy is not valid.", {
        instance,
        invalid_params: error.issues.map(({ field, reason }) => ({ name: `${policy}.${field}`, reason })),
      });
    }
    throw error;
  }

  if (auditLog) {
    auditLog.targetId = update.id;
    auditLog.oldObject = { policy, ...update.previous };
    auditLog.newObject = { policy, ...update.next };
    if (!update.changed) skipV3AuditLog(auditLog);
  }

  return successResponse(await readPoliciesDocument(access.organizationId), { requestId });
}
