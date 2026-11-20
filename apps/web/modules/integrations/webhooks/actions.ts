"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { assertCan } from "@/lib/authorization";
import { generateWebhookSecret } from "@/lib/crypto";
import { capturePostHogEvent } from "@/lib/posthog";
import { assertNewlyAttachedSurveysWorkspaceVisible } from "@/lib/survey/visibility/outbound";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import {
  getOrganizationIdFromWebhookId,
  getOrganizationIdFromWorkspaceId,
  getWorkspaceIdFromWebhookId,
} from "@/lib/utils/helper";
import {
  getWebhook,
  getWebhookWithSecret,
} from "@/modules/api/v2/management/webhooks/[webhookId]/lib/webhook";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import {
  createWebhook,
  deleteWebhook,
  testEndpoint,
  updateWebhook,
} from "@/modules/integrations/webhooks/lib/webhook";
import { ZWebhookInput } from "@/modules/integrations/webhooks/types/webhooks";

const ZCreateWebhookAction = z.object({
  workspaceId: ZId,
  webhookInput: ZWebhookInput,
  webhookSecret: z.string().optional(),
});

export const createWebhookAction = authenticatedActionClient.inputSchema(ZCreateWebhookAction).action(
  withAuditLogging("created", "webhook", async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromWorkspaceId(parsedInput.workspaceId);
    await assertCan({ type: "user", id: ctx.user.id }, "workspace.write", {
      type: "workspace",
      id: parsedInput.workspaceId,
    });
    await applyRateLimit(rateLimitConfigs.actions.stateMutation, parsedInput.workspaceId);
    await assertNewlyAttachedSurveysWorkspaceVisible(parsedInput.webhookInput.surveyIds ?? []);
    const webhook = await createWebhook(
      parsedInput.workspaceId,
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
        workspace_id: parsedInput.workspaceId,
      },
      { organizationId, workspaceId: parsedInput.workspaceId }
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
    const workspaceId = await getWorkspaceIdFromWebhookId(parsedInput.id);
    await assertCan({ type: "user", id: ctx.user.id }, "workspace.write", {
      type: "workspace",
      id: workspaceId,
    });
    await applyRateLimit(rateLimitConfigs.actions.stateMutation, workspaceId);

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
    const workspaceId = await getWorkspaceIdFromWebhookId(parsedInput.webhookId);
    await assertCan({ type: "user", id: ctx.user.id }, "workspace.write", {
      type: "workspace",
      id: workspaceId,
    });
    await applyRateLimit(rateLimitConfigs.actions.stateMutation, workspaceId);

    ctx.auditLoggingCtx.organizationId = organizationId;
    ctx.auditLoggingCtx.webhookId = parsedInput.webhookId;
    const existing = await getWebhook(parsedInput.webhookId);
    ctx.auditLoggingCtx.oldObject = existing;
    await assertNewlyAttachedSurveysWorkspaceVisible(
      parsedInput.webhookInput.surveyIds ?? [],
      existing.ok ? existing.data.surveyIds : []
    );

    const result = await updateWebhook(parsedInput.webhookId, parsedInput.webhookInput);
    ctx.auditLoggingCtx.newObject = await getWebhook(parsedInput.webhookId);
    return result;
  })
);

const ZGetWebhookSecretAction = z.object({
  webhookId: ZId,
});

// The signing secret is never part of the webhook list; a workspace writer reveals it here on demand.
export const getWebhookSecretAction = authenticatedActionClient
  .inputSchema(ZGetWebhookSecretAction)
  .action(async ({ ctx, parsedInput }) => {
    const workspaceId = await getWorkspaceIdFromWebhookId(parsedInput.webhookId);
    await assertCan({ type: "user", id: ctx.user.id }, "workspace.write", {
      type: "workspace",
      id: workspaceId,
    });
    // Per user and its own budget: a reveal is a read, and keying it on the workspace let any writer spend the
    // workspace's settings-write budget (and be spent by it).
    await applyRateLimit(rateLimitConfigs.actions.webhookSecretReveal, ctx.user.id);

    const webhookResult = await getWebhookWithSecret(parsedInput.webhookId);
    if (!webhookResult.ok || webhookResult.data.secret === null) {
      throw new ResourceNotFoundError("Webhook secret", parsedInput.webhookId);
    }

    return { secret: webhookResult.data.secret };
  });

const ZTestEndpointAction = z.object({
  url: z.string(),
  webhookId: ZId.optional(),
  // Required so the not-yet-created-webhook path has something to authorize against; without it this
  // action did no authorization at all and any logged-in user — including a billing-only member with no
  // product access — could make the server POST a signed test payload to any URL they named.
  workspaceId: ZId,
  secret: z.string().optional(),
});

export const testEndpointAction = authenticatedActionClient
  .inputSchema(ZTestEndpointAction)
  .action(async ({ ctx, parsedInput }) => {
    let workspaceId = parsedInput.workspaceId;
    if (parsedInput.webhookId) {
      workspaceId = await getWorkspaceIdFromWebhookId(parsedInput.webhookId);
    }

    await assertCan({ type: "user", id: ctx.user.id }, "workspace.write", {
      type: "workspace",
      id: workspaceId,
    });
    await applyRateLimit(rateLimitConfigs.actions.webhookTest, ctx.user.id);

    if (parsedInput.webhookId) {
      const webhookResult = await getWebhookWithSecret(parsedInput.webhookId);
      if (!webhookResult.ok) {
        throw new ResourceNotFoundError("Webhook", parsedInput.webhookId);
      }

      // The stored secret signs a request to the stored URL only. An edited URL that is not saved yet is
      // still testable, but under a throwaway secret, so a caller cannot aim the stored secret at a URL
      // of their choosing. The secret of an existing webhook is never returned here.
      const urlUnchanged = parsedInput.url === webhookResult.data.url;
      const secret = urlUnchanged ? (webhookResult.data.secret ?? undefined) : generateWebhookSecret();
      await testEndpoint(parsedInput.url, secret);
      return { success: true };
    }

    // New webhook: use the provided secret or generate one, and hand it back so the form can save it.
    const secret = parsedInput.secret ?? generateWebhookSecret();
    await testEndpoint(parsedInput.url, secret);
    return { success: true, secret };
  });
