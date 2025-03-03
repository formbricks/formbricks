"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import {
  getOrganizationIdFromApiKeyId,
  getOrganizationIdFromEnvironmentId,
  getProjectIdFromApiKeyId,
  getProjectIdFromEnvironmentId,
} from "@/lib/utils/helper";
import { createApiKey, deleteApiKey } from "@/modules/projects/settings/api-keys/lib/api-key";
import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZApiKeyCreateInput } from "./types/api-keys";

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
          type: "projectTeam",
          minPermission: "manage",
          projectId: await getProjectIdFromApiKeyId(parsedInput.id),
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
          type: "projectTeam",
          minPermission: "manage",
          projectId: await getProjectIdFromEnvironmentId(parsedInput.environmentId),
        },
      ],
    });

    return await createApiKey(parsedInput.environmentId, parsedInput.apiKeyData);
  });
