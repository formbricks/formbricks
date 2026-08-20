"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { assertCan } from "@/lib/authorization";
import { getOrganization } from "@/lib/organization/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";

const ZGetOrganizationBillingInfoAction = z.object({
  organizationId: ZId,
});

export const getOrganizationBillingInfoAction = authenticatedActionClient
  .inputSchema(ZGetOrganizationBillingInfoAction)
  .action(async ({ ctx, parsedInput }) => {
    await assertCan({ type: "user", id: ctx.user.id }, "organization.manage_billing", {
      type: "organization",
      id: parsedInput.organizationId,
    });

    const organization = await getOrganization(parsedInput.organizationId);
    return organization?.billing;
  });
