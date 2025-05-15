"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getOrganizationIdFromApiKeyId } from "@/lib/utils/helper";
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

export const deleteApiKeyAction = authenticatedActionClient
  .schema(ZDeleteApiKeyAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromApiKeyId(parsedInput.id),
      access: [
        {
          type: "organization",
          roles: ["owner"],
        },
      ],
    });

    return await deleteApiKey(parsedInput.id);
  });

const ZCreateApiKeyAction = z.object({
  organizationId: ZId,
  apiKeyData: ZApiKeyCreateInput,
});

export const createApiKeyAction = authenticatedActionClient
  .schema(ZCreateApiKeyAction)
  .action(async ({ ctx, parsedInput }) => {
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

    return await createApiKey(parsedInput.organizationId, ctx.user.id, parsedInput.apiKeyData);
  });

const ZUpdateApiKeyAction = z.object({
  apiKeyId: ZId,
  apiKeyData: ZApiKeyUpdateInput,
});

export const updateApiKeyAction = authenticatedActionClient
  .schema(ZUpdateApiKeyAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromApiKeyId(parsedInput.apiKeyId),
      access: [
        {
          type: "organization",
          roles: ["owner"],
        },
      ],
    });

    return await updateApiKey(parsedInput.apiKeyId, parsedInput.apiKeyData);
  });
