"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { generateWebhookSecret } from "@/lib/crypto";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
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

export const createWebhookAction = authenticatedActionClient.schema(ZCreateWebhookAction).action(
  withAuditLogging(
    "created",
    "webhook",
    async ({ ctx, parsedInput }: { ctx: AuthenticatedActionClientCtx; parsedInput: Record<string, any> }) => {
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
      const webhook = await createWebhook(
        parsedInput.environmentId,
        parsedInput.webhookInput,
        parsedInput.webhookSecret
      );
      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.newObject = parsedInput.webhookInput;
      return webhook;
    }
  )
);

const ZDeleteWebhookAction = z.object({
  id: ZId,
});

export const deleteWebhookAction = authenticatedActionClient.schema(ZDeleteWebhookAction).action(
  withAuditLogging(
    "deleted",
    "webhook",
    async ({ ctx, parsedInput }: { ctx: AuthenticatedActionClientCtx; parsedInput: Record<string, any> }) => {
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
    }
  )
);

const ZUpdateWebhookAction = z.object({
  webhookId: ZId,
  webhookInput: ZWebhookInput,
});

export const updateWebhookAction = authenticatedActionClient.schema(ZUpdateWebhookAction).action(
  withAuditLogging(
    "updated",
    "webhook",
    async ({ ctx, parsedInput }: { ctx: AuthenticatedActionClientCtx; parsedInput: Record<string, any> }) => {
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
    }
  )
);

const ZTestEndpointAction = z.object({
  url: z.string(),
  webhookId: ZId.optional(),
  secret: z.string().optional(),
});

export const testEndpointAction = authenticatedActionClient
  .schema(ZTestEndpointAction)
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
