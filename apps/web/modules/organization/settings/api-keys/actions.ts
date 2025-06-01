"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getOrganizationIdFromApiKeyId } from "@/lib/utils/helper";
import { getApiKey } from "@/lib/utils/services";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import {
  createApiKey,
  deleteApiKey,
  updateApiKey,
} from "@/modules/organization/settings/api-keys/lib/api-key";
import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZApiKeyCreateInput, ZApiKeyUpdateInput } from "./types/api-keys";

const ZDeleteApiKeyAction = z.object({
  id: ZId,
});

export const deleteApiKeyAction = authenticatedActionClient.schema(ZDeleteApiKeyAction).action(
  withAuditLogging("deleted", "apiKey", async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromApiKeyId(parsedInput.id);
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner"],
        },
      ],
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

export const createApiKeyAction = authenticatedActionClient.schema(ZCreateApiKeyAction).action(
  withAuditLogging("created", "apiKey", async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: parsedInput.organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner"],
        },
      ],
    });

    ctx.auditLoggingCtx.organizationId = parsedInput.organizationId;

    const result = await createApiKey(parsedInput.organizationId, ctx.user.id, parsedInput.apiKeyData);
    ctx.auditLoggingCtx.newObject = await getApiKey(result.id);
    ctx.auditLoggingCtx.apiKeyId = result.id;
    return result;
  })
);

const ZUpdateApiKeyAction = z.object({
  apiKeyId: ZId,
  apiKeyData: ZApiKeyUpdateInput,
});

export const updateApiKeyAction = authenticatedActionClient.schema(ZUpdateApiKeyAction).action(
  withAuditLogging("updated", "apiKey", async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromApiKeyId(parsedInput.apiKeyId);
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner"],
        },
      ],
    });

    ctx.auditLoggingCtx.organizationId = organizationId;
    ctx.auditLoggingCtx.apiKeyId = parsedInput.apiKeyId;
    ctx.auditLoggingCtx.newObject = parsedInput.apiKeyData;
    return await updateApiKey(parsedInput.apiKeyId, parsedInput.apiKeyData);
  })
);
