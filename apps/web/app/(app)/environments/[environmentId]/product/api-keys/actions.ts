"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import {
  getOrganizationIdFromApiKeyId,
  getOrganizationIdFromEnvironmentId,
  getProductIdFromApiKeyId,
  getProductIdFromEnvironmentId,
} from "@/lib/utils/helper";
import { z } from "zod";
import { createApiKey, deleteApiKey } from "@formbricks/lib/apiKey/service";
import { ZApiKeyCreateInput } from "@formbricks/types/api-keys";
import { ZId } from "@formbricks/types/common";

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
          roles: ["owner", "manager"],
        },
        {
          type: "productTeam",
          minPermission: "manage",
          productId: await getProductIdFromApiKeyId(parsedInput.id),
        },
      ],
    });

    return await deleteApiKey(parsedInput.id);
  });

const ZCreateApiKeyAction = z.object({
  environmentId: ZId,
  apiKeyData: ZApiKeyCreateInput,
});

export const createApiKeyAction = authenticatedActionClient
  .schema(ZCreateApiKeyAction)
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
          type: "productTeam",
          minPermission: "manage",
          productId: await getProductIdFromEnvironmentId(parsedInput.environmentId),
        },
      ],
    });

    return await createApiKey(parsedInput.environmentId, parsedInput.apiKeyData);
  });
