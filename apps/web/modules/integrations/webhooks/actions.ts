"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { generateWebhookSecret } from "@/lib/crypto";
import { capturePostHogEvent } from "@/lib/posthog";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
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

const ZCreateWebhookAction = z.object({
  environmentId: ZId,
  webhookInput: ZWebhookInput,
  webhookSecret: z.string().optional(),
});

export const createWebhookAction = authenticatedActionClient.inputSchema(ZCreateWebhookAction).action(
  withAuditLogging("created", "webhook", async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromEnvironmentId(parsedInput.environmentId);
    const projectId = await getProjectIdFromEnvironmentId(parsedInput.environmentId);
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
          projectId,
        },
      ],
    });
    const webhook = await createWebhook(
      parsedInput.environmentId,
      parsedInput.webhookInput,
      parsedInput.webhookSecret
    );
    ctx.auditLoggingCtx.organizationId = organizationId;
    ctx.auditLoggingCtx.newObject = parsedInput.webhookInput;

    capturePostHogEvent(
      ctx.user.id,
      "integration_connected",
      {
        integration_type: "webhook",
        organization_id: organizationId,
        workspace_id: projectId,
        environment_id: parsedInput.environmentId,
      },
      { organizationId, workspaceId: projectId }
    );

    return webhook;
  })
);

const ZDeleteWebhookAction = z.object({
  id: ZId,
});

export const deleteWebhookAction = authenticatedActionClient.inputSchema(ZDeleteWebhookAction).action(
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
    ctx.auditLoggingCtx.oldObject = { ...(await getWebhook(parsedInput.id)) };

    const result = await deleteWebhook(parsedInput.id);
    return result;
  })
);

const ZUpdateWebhookAction = z.object({
  webhookId: ZId,
  webhookInput: ZWebhookInput,
});

export const updateWebhookAction = authenticatedActionClient.inputSchema(ZUpdateWebhookAction).action(
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
    ctx.auditLoggingCtx.newObject = await getWebhook(parsedInput.webhookId);
    return result;
  })
);

const ZTestEndpointAction = z.object({
  url: z.string(),
  webhookId: ZId.optional(),
  secret: z.string().optional(),
});

export const testEndpointAction = authenticatedActionClient
  .inputSchema(ZTestEndpointAction)
  .action(async ({ ctx, parsedInput }) => {
    let secret: string | undefined;

    if (parsedInput.webhookId) {
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId: await getOrganizationIdFromWebhookId(parsedInput.webhookId),
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "projectTeam",
            minPermission: "read",
            projectId: await getProjectIdFromWebhookId(parsedInput.webhookId),
          },
        ],
      });

      const webhookResult = await getWebhook(parsedInput.webhookId);
      if (!webhookResult.ok) {
        throw new ResourceNotFoundError("Webhook", parsedInput.webhookId);
      }

      secret = webhookResult.data.secret ?? undefined;
    } else {
      // New webhook, use the provided secret or generate a new one
      secret = parsedInput.secret ?? generateWebhookSecret();
    }

    await testEndpoint(parsedInput.url, secret);
    return { success: true, secret };
  });
