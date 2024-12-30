"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import {
  removeOrganizationEmailLogoUrl,
  updateOrganizationEmailLogoUrl,
} from "@/modules/ee/whitelabel/email-customization/lib/organization";
import { z } from "zod";
import { ZId } from "@formbricks/types/common";

const ZUpdateOrganizationEmailLogoUrlAction = z.object({
  organizationId: ZId,
  logoUrl: z.string(),
});

export const updateOrganizationEmailLogoUrlAction = authenticatedActionClient
  .schema(ZUpdateOrganizationEmailLogoUrlAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: parsedInput.organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
      ],
    });

    return await updateOrganizationEmailLogoUrl(parsedInput.organizationId, parsedInput.logoUrl);
  });

const ZRemoveOrganizationEmailLogoUrlAction = z.object({
  organizationId: ZId,
});

export const removeOrganizationEmailLogoUrlAction = authenticatedActionClient
  .schema(ZRemoveOrganizationEmailLogoUrlAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: parsedInput.organizationId,
      access: [{ type: "organization", roles: ["owner", "manager"] }],
    });

    return await removeOrganizationEmailLogoUrl(parsedInput.organizationId);
  });
