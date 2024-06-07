"use server";

import { getServerSession } from "next-auth";

import { StripePriceLookupKeys } from "@formbricks/ee/billing/lib/constants";
import { createCustomerPortalSession } from "@formbricks/ee/billing/lib/create-customer-portal-session";
import { createSubscription } from "@formbricks/ee/billing/lib/create-subscription";
import { removeSubscription } from "@formbricks/ee/billing/lib/remove-subscription";
import { authOptions } from "@formbricks/lib/authOptions";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { canUserAccessOrganization } from "@formbricks/lib/organization/auth";
import { getOrganization } from "@formbricks/lib/organization/service";
import { AuthorizationError } from "@formbricks/types/errors";

export const upgradePlanAction = async (
  organizationId: string,
  environmentId: string,
  priceLookupKeys: StripePriceLookupKeys[]
) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessOrganization(session.user.id, organizationId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const subscriptionSession = await createSubscription(organizationId, environmentId, priceLookupKeys);

  return subscriptionSession;
};

export const manageSubscriptionAction = async (organizationId: string, environmentId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessOrganization(session.user.id, organizationId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const organization = await getOrganization(organizationId);
  if (!organization || !organization.billing.stripeCustomerId)
    throw new AuthorizationError("You do not have an associated Stripe CustomerId");

  const sessionUrl = await createCustomerPortalSession(
    organization.billing.stripeCustomerId,
    `${WEBAPP_URL}/environments/${environmentId}/settings/billing`
  );
  return sessionUrl;
};

export const removeSubscriptionAction = async (
  organizationId: string,
  environmentId: string,
  priceLookupKeys: StripePriceLookupKeys[]
) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessOrganization(session.user.id, organizationId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const removedSubscription = await removeSubscription(organizationId, environmentId, priceLookupKeys);

  return removedSubscription.url;
};
