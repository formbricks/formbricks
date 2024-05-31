"use server";

import { Organization } from "@prisma/client";
import { getServerSession } from "next-auth";

import { getIsMultiOrgEnabled } from "@formbricks/ee/lib/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { SHORT_URL_BASE, WEBAPP_URL } from "@formbricks/lib/constants";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { createMembership } from "@formbricks/lib/membership/service";
import { createOrganization, getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { createProduct } from "@formbricks/lib/product/service";
import { createShortUrl } from "@formbricks/lib/shortUrl/service";
import { updateUser } from "@formbricks/lib/user/service";
import { AuthenticationError, AuthorizationError, ResourceNotFoundError } from "@formbricks/types/errors";

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

export const createOrganizationAction = async (
  organizationName: string
): Promise<Organization | undefined> => {
  const isMultiOrgEnabled = await getIsMultiOrgEnabled();
  if (!isMultiOrgEnabled) return;
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

export const createProductAction = async (environmentId: string, productName: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await hasUserEnvironmentAccess(session.user.id, environmentId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const organization = await getOrganizationByEnvironmentId(environmentId);
  if (!organization) throw new ResourceNotFoundError("Organization from environment", environmentId);

  const product = await createProduct(organization.id, {
    name: productName,
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

  // get production environment
  const productionEnvironment = product.environments.find((environment) => environment.type === "production");
  if (!productionEnvironment) throw new ResourceNotFoundError("Production environment", environmentId);

  return productionEnvironment;
};
