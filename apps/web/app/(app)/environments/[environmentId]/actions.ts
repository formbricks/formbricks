"use server";

import { Organization } from "@prisma/client";
import { getServerSession } from "next-auth";
import { getIsMultiOrgEnabled } from "@formbricks/ee/lib/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { SHORT_URL_BASE, WEBAPP_URL } from "@formbricks/lib/constants";
import { createMembership, getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { createOrganization } from "@formbricks/lib/organization/service";
import { createProduct } from "@formbricks/lib/product/service";
import { createShortUrl } from "@formbricks/lib/shortUrl/service";
import { updateUser } from "@formbricks/lib/user/service";
import { AuthenticationError, AuthorizationError, OperationNotAllowedError } from "@formbricks/types/errors";
import { TProduct, TProductUpdateInput } from "@formbricks/types/product";

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

export const createProductAction = async (
  organizationId: string,
  productInput: TProductUpdateInput
): Promise<TProduct> => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authenticated");

  const membership = await getMembershipByUserIdOrganizationId(session.user.id, organizationId);
  if (!membership || membership.role === "viewer") {
    throw new AuthorizationError("Product creation not allowed");
  }

  const product = await createProduct(organizationId, productInput);
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

  return product;
};
