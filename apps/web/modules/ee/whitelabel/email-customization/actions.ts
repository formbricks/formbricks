"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getWhiteLabelPermission } from "@/modules/ee/license-check/lib/utils";
import {
  removeOrganizationEmailLogoUrl,
  updateOrganizationEmailLogoUrl,
} from "@/modules/ee/whitelabel/email-customization/lib/organization";
import { sendEmailCustomizationPreviewEmail } from "@/modules/email";
import { z } from "zod";
import { getOrganization } from "@formbricks/lib/organization/service";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";

export const checkWhiteLabelPermission = async (organizationId: string) => {
  const organization = await getOrganization(organizationId);

  if (!organization) {
    throw new ResourceNotFoundError("Organization", organizationId);
  }

  const isWhiteLabelAllowed = await getWhiteLabelPermission(organization.billing.plan);

  if (!isWhiteLabelAllowed) {
    throw new OperationNotAllowedError("White label is not allowed for this organization");
  }
};

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

    await checkWhiteLabelPermission(parsedInput.organizationId);
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

    await checkWhiteLabelPermission(parsedInput.organizationId);
    return await removeOrganizationEmailLogoUrl(parsedInput.organizationId);
  });

const ZSendTestEmailAction = z.object({
  organizationId: ZId,
});

export const sendTestEmailAction = authenticatedActionClient
  .schema(ZSendTestEmailAction)
  .action(async ({ ctx, parsedInput }) => {
    const organization = await getOrganization(parsedInput.organizationId);

    if (!organization) {
      throw new ResourceNotFoundError("Organization", parsedInput.organizationId);
    }

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: organization.id,
      access: [{ type: "organization", roles: ["owner", "manager"] }],
    });

    await checkWhiteLabelPermission(organization.id);

    await sendEmailCustomizationPreviewEmail(
      ctx.user.email,
      ctx.user.name,
      organization?.whitelabel?.logoUrl || ""
    );

    return { success: true };
  });
