/**
 * GET    /api/v3/organizations/{organizationId}/member-attribute-keys/{keyId} — one key.
 * PATCH  /api/v3/organizations/{organizationId}/member-attribute-keys/{keyId} — change its label or
 *        description (`key` never changes); `expectedUpdatedAt` compare-and-set, 409 when stale.
 * DELETE /api/v3/organizations/{organizationId}/member-attribute-keys/{keyId} — delete it and every value;
 *        409 `member_attribute_key_in_use` naming the Feedback Datasets whose Dashboard Viewer access uses it.
 *
 * A key of another organization, or none, answers 403.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import {
  deleteV3MemberAttributeKey,
  getV3MemberAttributeKey,
  updateV3MemberAttributeKey,
} from "../../member-attributes/lib/operations";
import {
  ZV3DeleteMemberAttributeKeyQuery,
  ZV3MemberAttributeKeyParams,
  ZV3UpdateMemberAttributeKeyBody,
} from "../../member-attributes/lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { params: ZV3MemberAttributeKeyParams },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getV3MemberAttributeKey({
      authentication,
      organizationId: parsedInput.params.organizationId,
      keyId: parsedInput.params.keyId,
      requestId,
      instance,
    }),
});

export const PATCH = withV3ApiWrapper({
  auth: "both",
  action: "updated",
  targetType: "memberAttributeKey",
  schemas: { params: ZV3MemberAttributeKeyParams, body: ZV3UpdateMemberAttributeKeyBody },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    updateV3MemberAttributeKey({
      authentication,
      organizationId: parsedInput.params.organizationId,
      keyId: parsedInput.params.keyId,
      body: parsedInput.body,
      auditLog,
      requestId,
      instance,
    }),
});

export const DELETE = withV3ApiWrapper({
  auth: "both",
  action: "deleted",
  targetType: "memberAttributeKey",
  schemas: { params: ZV3MemberAttributeKeyParams, query: ZV3DeleteMemberAttributeKeyQuery },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    deleteV3MemberAttributeKey({
      authentication,
      organizationId: parsedInput.params.organizationId,
      keyId: parsedInput.params.keyId,
      expectedUpdatedAt: parsedInput.query.expectedUpdatedAt,
      auditLog,
      requestId,
      instance,
    }),
});
