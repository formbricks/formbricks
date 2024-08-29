"use server";

import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import { createApiKey, deleteApiKey } from "@formbricks/lib/apiKey/service";
import {
  getOrganizationIdFromApiKeyId,
  getOrganizationIdFromEnvironmentId,
} from "@formbricks/lib/organization/utils";
import { ZApiKeyCreateInput } from "@formbricks/types/api-keys";
import { ZId } from "@formbricks/types/common";

const ZDeleteApiKeyAction = z.object({
  id: ZId,
});

export const deleteApiKeyAction = authenticatedActionClient
  .schema(ZDeleteApiKeyAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromApiKeyId(parsedInput.id),
      rules: ["apiKey", "delete"],
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
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      rules: ["apiKey", "create"],
    });

    return await createApiKey(parsedInput.environmentId, parsedInput.apiKeyData);
  });
