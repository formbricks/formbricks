"use server";

import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import {
  getOrganizationIdFromEnvironmentId,
  getOrganizationIdFromWebhookId,
} from "@formbricks/lib/organization/utils";
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
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      rules: ["webhook", "create"],
    });

    return await createWebhook(parsedInput.environmentId, parsedInput.webhookInput);
  });

const ZDeleteWebhookAction = z.object({
  id: ZId,
});

export const deleteWebhookAction = authenticatedActionClient
  .schema(ZDeleteWebhookAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromWebhookId(parsedInput.id),
      rules: ["webhook", "delete"],
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
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromWebhookId(parsedInput.webhookId),
      rules: ["webhook", "update"],
    });

    return await updateWebhook(parsedInput.webhookId, parsedInput.webhookInput);
  });

const ZTestEndpointAction = z.object({
  url: z.string(),
});

export const testEndpointAction = authenticatedActionClient
  .schema(ZTestEndpointAction)
  .action(async ({ parsedInput }) => {
    const res = await testEndpoint(parsedInput.url);

    if (!res.ok) {
      throw res.error;
    }
  });
