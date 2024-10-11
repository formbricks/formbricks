"use server";

import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import { createOrUpdateIntegration, deleteIntegration } from "@formbricks/lib/integration/service";
import { getOrganizationIdFromEnvironmentId } from "@formbricks/lib/organization/utils";
import { ZId } from "@formbricks/types/common";
import { ZIntegrationInput } from "@formbricks/types/integration";

const ZCreateOrUpdateIntegrationAction = z.object({
  environmentId: ZId,
  integrationData: ZIntegrationInput,
});

export const createOrUpdateIntegrationAction = authenticatedActionClient
  .schema(ZCreateOrUpdateIntegrationAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      rules: ["integration", "create"],
    });

    return await createOrUpdateIntegration(parsedInput.environmentId, parsedInput.integrationData);
  });

const ZDeleteIntegrationAction = z.object({
  integrationId: ZId,
});

export const deleteIntegrationAction = authenticatedActionClient
  .schema(ZDeleteIntegrationAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.integrationId),
      rules: ["integration", "delete"],
    });

    return await deleteIntegration(parsedInput.integrationId);
  });
