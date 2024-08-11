"use server";

import { z } from "zod";
import { getIsMultiOrgEnabled } from "@formbricks/ee/lib/service";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import { SHORT_URL_BASE, WEBAPP_URL } from "@formbricks/lib/constants";
import { createMembership } from "@formbricks/lib/membership/service";
import { createOrganization } from "@formbricks/lib/organization/service";
import { createProduct } from "@formbricks/lib/product/service";
import { createShortUrl } from "@formbricks/lib/shortUrl/service";
import { updateUser } from "@formbricks/lib/user/service";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { ZProductUpdateInput } from "@formbricks/types/product";
import { TUserNotificationSettings } from "@formbricks/types/user";

const ZCreateShortUrlAction = z.object({
  url: z.string(),
});

export const createShortUrlAction = authenticatedActionClient
  .schema(ZCreateShortUrlAction)
  .action(async ({ parsedInput }) => {
    const regexPattern = new RegExp("^" + WEBAPP_URL);
    const isValidUrl = regexPattern.test(parsedInput.url);

    if (!isValidUrl) throw new Error("Only Formbricks survey URLs are allowed");

    const shortUrl = await createShortUrl(parsedInput.url);
    const fullShortUrl = SHORT_URL_BASE + "/" + shortUrl.id;
    return fullShortUrl;
  });

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
  organizationId: z.string(),
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
