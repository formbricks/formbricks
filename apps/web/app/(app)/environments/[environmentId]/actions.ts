"use server";

import { Organization } from "@prisma/client";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { getIsMultiOrgEnabled } from "@formbricks/ee/lib/service";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import { authOptions } from "@formbricks/lib/authOptions";
import { SHORT_URL_BASE, WEBAPP_URL } from "@formbricks/lib/constants";
import { createMembership } from "@formbricks/lib/membership/service";
import { createOrganization } from "@formbricks/lib/organization/service";
import { createProduct } from "@formbricks/lib/product/service";
import { createShortUrl } from "@formbricks/lib/shortUrl/service";
import { updateUser } from "@formbricks/lib/user/service";
import { AuthenticationError, AuthorizationError, OperationNotAllowedError } from "@formbricks/types/errors";
import { ZProductUpdateInput } from "@formbricks/types/product";
import { TUserNotificationSettings } from "@formbricks/types/user";

export const createShortUrlAction = async (url: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthenticationError("Not authenticated");

  const regexPattern = new RegExp("^" + WEBAPP_URL);
  const isValidUrl = regexPattern.test(url);

  if (!isValidUrl) throw new Error("Only Formbricks survey URLs are allowed");

  const shortUrl = await createShortUrl(url);
  const fullShortUrl = SHORT_URL_BASE + "/" + shortUrl.id;
  return fullShortUrl;
};

export const createOrganizationAction = async (organizationName: string): Promise<Organization> => {
  const isMultiOrgEnabled = await getIsMultiOrgEnabled();
  if (!isMultiOrgEnabled)
    throw new OperationNotAllowedError(
      "Creating Multiple organization is restricted on your instance of Formbricks"
    );
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const newOrganization = await createOrganization({
    name: organizationName,
  });

  await createMembership(newOrganization.id, session.user.id, {
    role: "owner",
    accepted: true,
  });

  const product = await createProduct(newOrganization.id, {
    name: "My Product",
  });

  const updatedNotificationSettings: TUserNotificationSettings = {
    ...session.user.notificationSettings,
    alert: {
      ...session.user.notificationSettings?.alert,
    },
    weeklySummary: {
      ...session.user.notificationSettings?.weeklySummary,
      [product.id]: true,
    },
    unsubscribedOrganizationIds: Array.from(
      new Set([...(session.user.notificationSettings?.unsubscribedOrganizationIds || []), newOrganization.id])
    ),
  };

  await updateUser(session.user.id, {
    notificationSettings: updatedNotificationSettings,
  });

  return newOrganization;
};

const ZCreateProductAction = z.object({
  organizationId: z.string(),
  data: ZProductUpdateInput,
});

export const createProductAction = authenticatedActionClient
  .schema(ZCreateProductAction)
  .action(async ({ parsedInput, ctx }) => {
    const organizationId = parsedInput.organizationId;
    await checkAuthorization({
      schema: ZProductUpdateInput,
      data: parsedInput.data,
      userId: ctx.user.id,
      organizationId: organizationId,
      rules: ["product", "create"],
    });

    const { user } = ctx;

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
