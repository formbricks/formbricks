"use server";

import { Organization } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@formbricks/lib/authOptions";
import { gethasNoOrganizations } from "@formbricks/lib/instance/service";
import { createMembership } from "@formbricks/lib/membership/service";
import { createOrganization } from "@formbricks/lib/organization/service";
import { createProduct } from "@formbricks/lib/product/service";
import { updateUser } from "@formbricks/lib/user/service";
import { AuthorizationError, OperationNotAllowedError } from "@formbricks/types/errors";

export const createOrganizationAction = async (organizationName: string): Promise<Organization> => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const hasNoOrganizations = await gethasNoOrganizations();
  if (!hasNoOrganizations) {
    throw new OperationNotAllowedError("This action can only be performed on a fresh instance.");
  }

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

  const updatedNotificationSettings = {
    ...session.user.notificationSettings,
    alert: {
      ...session.user.notificationSettings?.alert,
    },
    weeklySummary: {
      ...session.user.notificationSettings?.weeklySummary,
      [product.id]: true,
    },
  };

  await updateUser(session.user.id, {
    notificationSettings: updatedNotificationSettings,
  });

  return newOrganization;
};
