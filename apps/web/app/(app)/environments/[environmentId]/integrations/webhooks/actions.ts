"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import {
  getOrganizationIdFromEnvironmentId,
  getOrganizationIdFromWebhookId,
  getProjectIdFromEnvironmentId,
  getProjectIdFromWebhookId,
} from "@/lib/utils/helper";
import { z } from "zod";
import { createWebhook, deleteWebhook, updateWebhook } from "@formbricks/lib/webhook/service";
import { testEndpoint } from "@formbricks/lib/webhook/utils";
import { ZId } from "@formbricks/types/common";
import { ZWebhookInput } from "@formbricks/types/webhooks";

const ZCreateWebhookAction = z.object({
  environmentId: ZId,
  webhookInput: ZWebhookInput,
});

export const createWebhookAction = authenticatedActionClient
  .schema(ZCreateWebhookAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
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

    return await createWebhook(parsedInput.environmentId, parsedInput.webhookInput);
  });

const ZDeleteWebhookAction = z.object({
  id: ZId,
});

export const deleteWebhookAction = authenticatedActionClient
  .schema(ZDeleteWebhookAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromWebhookId(parsedInput.id),
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

    return await deleteWebhook(parsedInput.id);
  });

const ZUpdateWebhookAction = z.object({
  webhookId: ZId,
  webhookInput: ZWebhookInput,
});

export const updateWebhookAction = authenticatedActionClient
  .schema(ZUpdateWebhookAction)
  .action(async ({ ctx, parsedInput }) => {
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
          minPermission: "readWrite",
          projectId: await getProjectIdFromWebhookId(parsedInput.webhookId),
        },
      ],
    });

    return await updateWebhook(parsedInput.webhookId, parsedInput.webhookInput);
  });

const ZTestEndpointAction = z.object({
  url: z.string(),
});

export const testEndpointAction = authenticatedActionClient
  .schema(ZTestEndpointAction)
  .action(async ({ parsedInput }) => {
    return testEndpoint(parsedInput.url);
  });
