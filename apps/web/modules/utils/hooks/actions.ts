"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { z } from "zod";
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
          roles: ["owner", "manager", "billing"],
        },
      ],
    });

    const organization = await getOrganization(parsedInput.organizationId);
    return organization?.billing;
  });
