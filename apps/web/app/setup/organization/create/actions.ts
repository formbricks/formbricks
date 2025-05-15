"use server";

import { gethasNoOrganizations } from "@/lib/instance/service";
import { createMembership } from "@/lib/membership/service";
import { createOrganization } from "@/lib/organization/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { z } from "zod";
import { OperationNotAllowedError } from "@formbricks/types/errors";

const ZCreateOrganizationAction = z.object({
  organizationName: z.string(),
});

export const createOrganizationAction = authenticatedActionClient
  .schema(ZCreateOrganizationAction)
  .action(async ({ ctx, parsedInput }) => {
    const hasNoOrganizations = await gethasNoOrganizations();
    const isMultiOrgEnabled = await getIsMultiOrgEnabled();

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
