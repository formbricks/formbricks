"use server";

import { Organization } from "@prisma/client";
import { getServerSession } from "next-auth";
import { getIsMultiOrgEnabled } from "@formbricks/ee/lib/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { SHORT_URL_BASE, WEBAPP_URL } from "@formbricks/lib/constants";
import { hasUserEnvironmentAccess, verifyUserRoleAccess } from "@formbricks/lib/environment/auth";
import { createMembership, getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import {
  createOrganization,
  getOrganization,
  getOrganizationByEnvironmentId,
} from "@formbricks/lib/organization/service";
import { createProduct } from "@formbricks/lib/product/service";
import { createShortUrl } from "@formbricks/lib/shortUrl/service";
import { updateUser } from "@formbricks/lib/user/service";
import {
  AuthenticationError,
  AuthorizationError,
  OperationNotAllowedError,
  ResourceNotFoundError,
} from "@formbricks/types/errors";
import { TProduct, TProductUpdateInput } from "@formbricks/types/product";
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

  const organization = await getOrganization(organizationId);
  if (!organization) throw new ResourceNotFoundError("Organization not found", organizationId);

  const { hasCreateOrUpdateAccess } = await verifyUserRoleAccess(organization.id, session.user.id);
  if (!hasCreateOrUpdateAccess) throw new AuthorizationError("Not authorized");

  const product = await createProduct(organization.id, productInput);
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
