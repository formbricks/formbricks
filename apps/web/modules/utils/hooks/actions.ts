"use server";

import "server-only";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { getOrganization } from "@formbricks/lib/organization/service";
import { ZId } from "@formbricks/types/common";

const ZGetOrganizationBillingInfoAction = z.object({
  organizationId: ZId,
});

export const getOrganizationBillingInfoAction = authenticatedActionClient
  .schema(ZGetOrganizationBillingInfoAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: parsedInput.organizationId,
      access: [
        {
          type: "organization",
          rules: ["subscription", "read"],
        },
      ],
    });

    const organization = await getOrganization(parsedInput.organizationId);
    return organization?.billing;
  });
