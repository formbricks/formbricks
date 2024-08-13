"use server";

import "server-only";
import { z } from "zod";
import { authenticatedActionClient } from "../../actionClient";
import { checkAuthorization } from "../../actionClient/utils";
import { getOrganization } from "../service";

const ZGetOrganizationBillingInfoAction = z.object({
  organizationId: z.string(),
});

export const getOrganizationBillingInfoAction = authenticatedActionClient
  .schema(ZGetOrganizationBillingInfoAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: parsedInput.organizationId,
      rules: ["organization", "read"],
    });

    const organization = await getOrganization(parsedInput.organizationId);

    return organization?.billing;
  });
