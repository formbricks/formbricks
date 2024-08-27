"use server";

import { z } from "zod";
import { getIsMultiOrgEnabled } from "@formbricks/ee/lib/service";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import { createMembership } from "@formbricks/lib/membership/service";
import { createOrganization } from "@formbricks/lib/organization/service";
import { createProduct } from "@formbricks/lib/product/service";
import { updateUser } from "@formbricks/lib/user/service";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { ZProductUpdateInput } from "@formbricks/types/product";
import { TUserNotificationSettings } from "@formbricks/types/user";

const ZCreateOrganizationAction = z.object({
  organizationName: z.string(),
});

export const createOrganizationAction = authenticatedActionClient
  .schema(ZCreateOrganizationAction)
  .action(async ({ ctx, parsedInput }) => {
    const isMultiOrgEnabled = await getIsMultiOrgEnabled();
    if (!isMultiOrgEnabled)
      throw new OperationNotAllowedError(
        "Creating Multiple organization is restricted on your instance of Formbricks"
      );

    const newOrganization = await createOrganization({
      name: parsedInput.organizationName,
    });

    await createMembership(newOrganization.id, ctx.user.id, {
      role: "owner",
      accepted: true,
    });

    const product = await createProduct(newOrganization.id, {
      name: "My Product",
    });

    const updatedNotificationSettings: TUserNotificationSettings = {
      ...ctx.user.notificationSettings,
      alert: {
        ...ctx.user.notificationSettings?.alert,
      },
      weeklySummary: {
        ...ctx.user.notificationSettings?.weeklySummary,
        [product.id]: true,
      },
      unsubscribedOrganizationIds: Array.from(
        new Set([...(ctx.user.notificationSettings?.unsubscribedOrganizationIds || []), newOrganization.id])
      ),
    };

    await updateUser(ctx.user.id, {
      notificationSettings: updatedNotificationSettings,
    });

    return newOrganization;
  });

const ZCreateProductAction = z.object({
  organizationId: ZId,
  data: ZProductUpdateInput,
});

export const createProductAction = authenticatedActionClient
  .schema(ZCreateProductAction)
  .action(async ({ parsedInput, ctx }) => {
    const { user } = ctx;

    await checkAuthorization({
      schema: ZProductUpdateInput,
      data: parsedInput.data,
      userId: user.id,
      organizationId: parsedInput.organizationId,
      rules: ["product", "create"],
    });

    const product = await createProduct(parsedInput.organizationId, parsedInput.data);
    const updatedNotificationSettings = {
      ...user.notificationSettings,
      alert: {
        ...user.notificationSettings?.alert,
      },
      weeklySummary: {
        ...user.notificationSettings?.weeklySummary,
        [product.id]: true,
      },
    };

    await updateUser(user.id, {
      notificationSettings: updatedNotificationSettings,
    });

    return product;
  });
