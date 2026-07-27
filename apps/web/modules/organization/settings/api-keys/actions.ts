"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { assertCan } from "@/lib/authorization";
import { capturePostHogEvent } from "@/lib/posthog";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { getOrganizationIdFromApiKeyId } from "@/lib/utils/helper";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import {
  createApiKey,
  deleteApiKey,
  updateApiKey,
} from "@/modules/organization/settings/api-keys/lib/api-key";
import { ZApiKeyCreateInput, ZApiKeyUpdateInput } from "./types/api-keys";

const ZDeleteApiKeyAction = z.object({
  id: ZId,
});

export const deleteApiKeyAction = authenticatedActionClient.inputSchema(ZDeleteApiKeyAction).action(
  withAuditLogging("deleted", "apiKey", async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromApiKeyId(parsedInput.id);
    await assertCan({ type: "user", id: ctx.user.id }, "apiKey.manage", {
      type: "apiKey",
      id: parsedInput.id,
    });

    ctx.auditLoggingCtx.organizationId = organizationId;
    ctx.auditLoggingCtx.apiKeyId = parsedInput.id;

    const result = await deleteApiKey(parsedInput.id);
    ctx.auditLoggingCtx.oldObject = result;
    return result;
  })
);

const ZCreateApiKeyAction = z.object({
  organizationId: ZId,
  apiKeyData: ZApiKeyCreateInput,
});

export const createApiKeyAction = authenticatedActionClient.inputSchema(ZCreateApiKeyAction).action(
  withAuditLogging("created", "apiKey", async ({ ctx, parsedInput }) => {
    await assertCan({ type: "user", id: ctx.user.id }, "organization.manage_api_keys", {
      type: "organization",
      id: parsedInput.organizationId,
    });

    ctx.auditLoggingCtx.organizationId = parsedInput.organizationId;

    const result = await createApiKey(parsedInput.organizationId, ctx.user.id, parsedInput.apiKeyData);
    ctx.auditLoggingCtx.newObject = parsedInput.apiKeyData;
    ctx.auditLoggingCtx.apiKeyId = result.id;
    capturePostHogEvent(
      ctx.user.id,
      "api_key_created",
      { api_key_id: result.id },
      { organizationId: parsedInput.organizationId }
    );
    return result;
  })
);

const ZUpdateApiKeyAction = z.object({
  apiKeyId: ZId,
  apiKeyData: ZApiKeyUpdateInput,
});

export const updateApiKeyAction = authenticatedActionClient.inputSchema(ZUpdateApiKeyAction).action(
  withAuditLogging("updated", "apiKey", async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromApiKeyId(parsedInput.apiKeyId);
    await assertCan({ type: "user", id: ctx.user.id }, "apiKey.manage", {
      type: "apiKey",
      id: parsedInput.apiKeyId,
    });

    ctx.auditLoggingCtx.organizationId = organizationId;
    ctx.auditLoggingCtx.apiKeyId = parsedInput.apiKeyId;
    ctx.auditLoggingCtx.newObject = parsedInput.apiKeyData;
    return await updateApiKey(parsedInput.apiKeyId, parsedInput.apiKeyData);
  })
);
