"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import {
  getOrganizationIdFromEnvironmentId,
  getOrganizationIdFromWebhookId,
  getProjectIdFromEnvironmentId,
  getProjectIdFromWebhookId,
} from "@/lib/utils/helper";
import { getWebhook } from "@/modules/api/v2/management/webhooks/[webhookId]/lib/webhook";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import {
  createWebhook,
  deleteWebhook,
  testEndpoint,
  updateWebhook,
} from "@/modules/integrations/webhooks/lib/webhook";
import { ZWebhookInput } from "@/modules/integrations/webhooks/types/webhooks";
import { z } from "zod";
import { ZId } from "@formbricks/types/common";

const ZCreateWebhookAction = z.object({
  environmentId: ZId,
  webhookInput: ZWebhookInput,
});

export const createWebhookAction = authenticatedActionClient.schema(ZCreateWebhookAction).action(
  withAuditLogging("created", "webhook", async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromEnvironmentId(parsedInput.environmentId);
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          minPermission: "read",
          projectId: await getProjectIdFromEnvironmentId(parsedInput.environmentId),
        },
      ],
    });
    const webhook = await createWebhook(parsedInput.environmentId, parsedInput.webhookInput);
    ctx.auditLoggingCtx.organizationId = organizationId;
    ctx.auditLoggingCtx.newObject = webhook;
    return webhook;
  })
);

const ZDeleteWebhookAction = z.object({
  id: ZId,
});

export const deleteWebhookAction = authenticatedActionClient.schema(ZDeleteWebhookAction).action(
  withAuditLogging("deleted", "webhook", async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromWebhookId(parsedInput.id);
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          minPermission: "readWrite",
          projectId: await getProjectIdFromWebhookId(parsedInput.id),
        },
      ],
    });

    ctx.auditLoggingCtx.organizationId = organizationId;
    ctx.auditLoggingCtx.webhookId = parsedInput.id;

    const result = await deleteWebhook(parsedInput.id);
    ctx.auditLoggingCtx.newObject = result;
    return result;
  })
);

const ZUpdateWebhookAction = z.object({
  webhookId: ZId,
  webhookInput: ZWebhookInput,
});

export const updateWebhookAction = authenticatedActionClient.schema(ZUpdateWebhookAction).action(
  withAuditLogging("updated", "webhook", async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromWebhookId(parsedInput.webhookId);
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          minPermission: "readWrite",
          projectId: await getProjectIdFromWebhookId(parsedInput.webhookId),
        },
      ],
    });

    ctx.auditLoggingCtx.organizationId = organizationId;
    ctx.auditLoggingCtx.webhookId = parsedInput.webhookId;
    ctx.auditLoggingCtx.oldObject = await getWebhook(parsedInput.webhookId);

    const result = await updateWebhook(parsedInput.webhookId, parsedInput.webhookInput);
    ctx.auditLoggingCtx.newObject = result;
    return result;
  })
);

const ZTestEndpointAction = z.object({
  url: z.string(),
});

export const testEndpointAction = authenticatedActionClient
  .schema(ZTestEndpointAction)
  .action(async ({ parsedInput }) => {
    return testEndpoint(parsedInput.url);
  });
