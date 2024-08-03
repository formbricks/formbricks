"use server";

import { Organization } from "@prisma/client";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { getIsMultiOrgEnabled } from "@formbricks/ee/lib/service";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import { authOptions } from "@formbricks/lib/authOptions";
import { createMembership } from "@formbricks/lib/membership/service";
import { createOrganization } from "@formbricks/lib/organization/service";
import { createProduct } from "@formbricks/lib/product/service";
import { getUser, updateUser } from "@formbricks/lib/user/service";
import { AuthorizationError, OperationNotAllowedError } from "@formbricks/types/errors";
import { ZProductUpdateInput } from "@formbricks/types/product";
import { TUserNotificationSettings } from "@formbricks/types/user";

export const createOrganizationAction = async (organizationName: string): Promise<Organization> => {
  const isMultiOrgEnabled = await getIsMultiOrgEnabled();
  if (!isMultiOrgEnabled)
    throw new OperationNotAllowedError(
      "Creating Multiple organization is restricted on your instance of Formbricks"
    );
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const user = await getUser(session.user.id);
  if (!user) throw new Error("User not found");

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
    ...user.notificationSettings,
    alert: {
      ...user.notificationSettings?.alert,
    },
    weeklySummary: {
      ...user.notificationSettings?.weeklySummary,
      [product.id]: true,
    },
    unsubscribedOrganizationIds: Array.from(
      new Set([...(user.notificationSettings?.unsubscribedOrganizationIds || []), newOrganization.id])
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
