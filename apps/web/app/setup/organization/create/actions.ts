"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { z } from "zod";
import { gethasNoOrganizations } from "@formbricks/lib/instance/service";
import { createMembership } from "@formbricks/lib/membership/service";
import { createOrganization } from "@formbricks/lib/organization/service";
import { OperationNotAllowedError } from "@formbricks/types/errors";

const ZCreateOrganizationAction = z.object({
  organizationName: z.string(),
});

export const createOrganizationAction = authenticatedActionClient
  .schema(ZCreateOrganizationAction)
  .action(async ({ ctx, parsedInput }) => {
    const hasNoOrganizations = await gethasNoOrganizations();
    const isMultiOrgEnabled = false;

    if (!hasNoOrganizations && !isMultiOrgEnabled) {
      throw new OperationNotAllowedError("This action can only be performed on a fresh instance.");
    }

    const newOrganization = await createOrganization({
      name: parsedInput.organizationName,
    });

    await createMembership(newOrganization.id, ctx.user.id, {
      role: "owner",
      accepted: true,
    });

    return newOrganization;
  });
