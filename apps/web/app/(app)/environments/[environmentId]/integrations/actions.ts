"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getOrganizationIdFromEnvironmentId, getOrganizationIdFromIntegrationId } from "@/lib/utils/helper";
import { z } from "zod";
import { createOrUpdateIntegration, deleteIntegration } from "@formbricks/lib/integration/service";
import { ZId } from "@formbricks/types/common";
import { ZIntegrationInput } from "@formbricks/types/integration";

const ZCreateOrUpdateIntegrationAction = z.object({
  environmentId: ZId,
  integrationData: ZIntegrationInput,
});

export const createOrUpdateIntegrationAction = authenticatedActionClient
  .schema(ZCreateOrUpdateIntegrationAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
      ],
    });

    return await createOrUpdateIntegration(parsedInput.environmentId, parsedInput.integrationData);
  });

const ZDeleteIntegrationAction = z.object({
  integrationId: ZId,
});

export const deleteIntegrationAction = authenticatedActionClient
  .schema(ZDeleteIntegrationAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromIntegrationId(parsedInput.integrationId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
      ],
    });

    return await deleteIntegration(parsedInput.integrationId);
  });
