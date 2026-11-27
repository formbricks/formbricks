import { NextRequest } from "next/server";
import { z } from "zod";
import type { TAuthenticationApiKey } from "@formbricks/types/auth";
import { getWorkspaceAuthorizationActionForMethod } from "@/lib/authorization/permission-action";
import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import {
  deleteContactAttributeKey,
  getContactAttributeKey,
  updateContactAttributeKey,
} from "@/modules/api/v2/management/contact-attribute-keys/[contactAttributeKeyId]/lib/contact-attribute-key";
import {
  ZContactAttributeKeyIdSchema,
  ZContactAttributeKeyUpdateSchema,
} from "@/modules/api/v2/management/contact-attribute-keys/[contactAttributeKeyId]/types/contact-attribute-keys";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { findApiKeyWorkspaceOnDirectory } from "@/modules/ee/contacts/lib/api-key-directory-access";
import { withCallerWorkspace } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { checkContactsEnabledApiV2 } from "@/modules/ee/license-check/lib/contacts-api-guard";

type TKeyWithDirectory = Extract<Awaited<ReturnType<typeof getContactAttributeKey>>, { ok: true }>["data"];

/**
 * A key's own `workspaceId` only records where it was created, so access goes through its directory: the
 * API key must reach a workspace that uses it. Returns that workspace and the key as it reports there.
 */
const authorizeKey = async (
  authentication: TAuthenticationApiKey,
  { directoryId, ...key }: TKeyWithDirectory,
  method: "GET" | "PUT" | "DELETE"
) => {
  const workspaceId = await findApiKeyWorkspaceOnDirectory(
    authentication.apiKeyId,
    getWorkspaceAuthorizationActionForMethod(method),
    directoryId,
    authentication.workspacePermissions.map((permission) => permission.workspaceId)
  );
  return workspaceId ? { workspaceId, key: withCallerWorkspace(key, workspaceId) } : null;
};

export const GET = async (
  request: NextRequest,
  props: { params: Promise<{ contactAttributeKeyId: string }> }
) =>
  authenticatedApiClient({
    request,
    schemas: {
      params: z.object({ contactAttributeKeyId: ZContactAttributeKeyIdSchema }),
    },
    externalParams: props.params,
    handler: async ({ authentication, parsedInput }) => {
      const { params } = parsedInput;

      const contactsNotEnabledError = await checkContactsEnabledApiV2(authentication.organizationId);
      if (contactsNotEnabledError) {
        return handleApiError(request, contactsNotEnabledError);
      }

      const res = await getContactAttributeKey(params.contactAttributeKeyId);

      if (!res.ok) {
        return handleApiError(request, res.error as ApiErrorResponseV2);
      }

      const authorized = await authorizeKey(authentication, res.data, "GET");
      if (!authorized) {
        return handleApiError(request, {
          type: "unauthorized",
          details: [{ field: "environment", issue: "unauthorized" }],
        });
      }

      return responses.successResponse({ data: authorized.key });
    },
  });

export const PUT = async (
  request: NextRequest,
  props: { params: Promise<{ contactAttributeKeyId: string }> }
) =>
  authenticatedApiClient({
    request,
    schemas: {
      params: z.object({ contactAttributeKeyId: ZContactAttributeKeyIdSchema }),
      body: ZContactAttributeKeyUpdateSchema,
    },
    externalParams: props.params,
    handler: async ({ authentication, parsedInput, auditLog }) => {
      const { params, body } = parsedInput;

      if (auditLog) {
        auditLog.targetId = params.contactAttributeKeyId;
      }

      const contactsNotEnabledError = await checkContactsEnabledApiV2(authentication.organizationId);
      if (contactsNotEnabledError) {
        return handleApiError(request, contactsNotEnabledError, auditLog);
      }

      const res = await getContactAttributeKey(params.contactAttributeKeyId);

      if (!res.ok) {
        return handleApiError(request, res.error as ApiErrorResponseV2, auditLog);
      }
      const authorized = await authorizeKey(authentication, res.data, "PUT");
      if (!authorized) {
        return handleApiError(
          request,
          {
            type: "unauthorized",
            details: [{ field: "environment", issue: "unauthorized" }],
          },
          auditLog
        );
      }

      if (res.data.type === "default") {
        return handleApiError(
          request,
          {
            type: "bad_request",
            details: [{ field: "contactAttributeKey", issue: "cannot update default contact attribute key" }],
          },
          auditLog
        );
      }

      if (res.data.isUnique) {
        return handleApiError(
          request,
          {
            type: "bad_request",
            details: [{ field: "contactAttributeKey", issue: "cannot update unique contact attribute key" }],
          },
          auditLog
        );
      }

      const updatedContactAttributeKey = await updateContactAttributeKey(
        params.contactAttributeKeyId,
        authorized.workspaceId,
        body
      );

      if (!updatedContactAttributeKey.ok) {
        return handleApiError(request, updatedContactAttributeKey.error, auditLog);
      }

      if (auditLog) {
        auditLog.oldObject = authorized.key;
        auditLog.newObject = updatedContactAttributeKey.data;
      }

      return responses.successResponse(updatedContactAttributeKey);
    },
    action: "updated",
    targetType: "contactAttributeKey",
  });

export const DELETE = async (
  request: NextRequest,
  props: { params: Promise<{ contactAttributeKeyId: string }> }
) =>
  authenticatedApiClient({
    request,
    schemas: {
      params: z.object({ contactAttributeKeyId: ZContactAttributeKeyIdSchema }),
    },
    externalParams: props.params,
    handler: async ({ authentication, parsedInput, auditLog }) => {
      const { params } = parsedInput;

      if (auditLog) {
        auditLog.targetId = params.contactAttributeKeyId;
      }

      const contactsNotEnabledError = await checkContactsEnabledApiV2(authentication.organizationId);
      if (contactsNotEnabledError) {
        return handleApiError(request, contactsNotEnabledError, auditLog);
      }

      const res = await getContactAttributeKey(params.contactAttributeKeyId);

      if (!res.ok) {
        return handleApiError(request, res.error as ApiErrorResponseV2, auditLog);
      }

      const authorized = await authorizeKey(authentication, res.data, "DELETE");
      if (!authorized) {
        return handleApiError(
          request,
          {
            type: "unauthorized",
            details: [{ field: "environment", issue: "unauthorized" }],
          },
          auditLog
        );
      }

      if (res.data.type === "default") {
        return handleApiError(
          request,
          {
            type: "bad_request",
            details: [{ field: "contactAttributeKey", issue: "cannot delete default contact attribute key" }],
          },
          auditLog
        );
      }

      if (res.data.isUnique) {
        return handleApiError(
          request,
          {
            type: "bad_request",
            details: [{ field: "contactAttributeKey", issue: "cannot delete unique contactAttributeKey" }],
          },
          auditLog
        );
      }

      const deletedContactAttributeKey = await deleteContactAttributeKey(
        params.contactAttributeKeyId,
        authorized.workspaceId
      );

      if (!deletedContactAttributeKey.ok) {
        return handleApiError(request, deletedContactAttributeKey.error, auditLog); // NOSONAR // We need to assert or we get a type error
      }

      if (auditLog) {
        auditLog.oldObject = authorized.key;
      }

      return responses.successResponse(deletedContactAttributeKey);
    },
    action: "deleted",
    targetType: "contactAttributeKey",
  });
