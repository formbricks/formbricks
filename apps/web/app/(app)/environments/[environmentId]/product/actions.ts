"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getOrganizationIdFromProductId } from "@/lib/utils/helper";
import { z } from "zod";
import {
  getRemoveInAppBrandingPermission,
  getRemoveLinkBrandingPermission,
} from "@formbricks/ee/lib/service";
import { getOrganization } from "@formbricks/lib/organization/service";
import { updateProduct } from "@formbricks/lib/product/service";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { ZProductUpdateInput } from "@formbricks/types/product";

const ZUpdateProductAction = z.object({
  productId: ZId,
  data: ZProductUpdateInput,
});

export const updateProductAction = authenticatedActionClient
  .schema(ZUpdateProductAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromProductId(parsedInput.productId);

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          schema: ZProductUpdateInput,
          data: parsedInput.data,
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "productTeam",
          productId: parsedInput.productId,
          minPermission: "manage",
        },
      ],
    });

    if (
      parsedInput.data.inAppSurveyBranding !== undefined ||
      parsedInput.data.linkSurveyBranding !== undefined
    ) {
      const organization = await getOrganization(organizationId);

      if (!organization) {
        throw new Error("Organization not found");
      }

      if (parsedInput.data.inAppSurveyBranding) {
        const canRemoveInAppBranding = getRemoveInAppBrandingPermission(organization);
        if (!canRemoveInAppBranding) {
          throw new OperationNotAllowedError("You are not allowed to remove in-app branding");
        }
      }

      if (parsedInput.data.linkSurveyBranding) {
        const canRemoveLinkSurveyBranding = getRemoveLinkBrandingPermission(organization);
        if (!canRemoveLinkSurveyBranding) {
          throw new OperationNotAllowedError("You are not allowed to remove link survey branding");
        }
      }
    }

    return await updateProduct(parsedInput.productId, parsedInput.data);
  });
