"use server";

import { getServerSession } from "next-auth";

import { STRIPE_PRICE_LOOKUP_KEYS } from "@formbricks/ee/billing/lib/constants";
import { createCustomerPortalSession } from "@formbricks/ee/billing/lib/createCustomerPortalSession";
import { createSubscription } from "@formbricks/ee/billing/lib/createSubscription";
import { isSubscriptionCancelled } from "@formbricks/ee/billing/lib/isSubscriptionCancelled";
import { authOptions } from "@formbricks/lib/authOptions";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { canUserAccessOrganization } from "@formbricks/lib/organization/auth";
import { getOrganization } from "@formbricks/lib/organization/service";
import { AuthorizationError } from "@formbricks/types/errors";

export const upgradePlanAction = async (
  organizationId: string,
  environmentId: string,
  priceLookupKey: STRIPE_PRICE_LOOKUP_KEYS
) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessOrganization(session.user.id, organizationId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const subscriptionSession = await createSubscription(organizationId, environmentId, priceLookupKey);

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

export const isSubscriptionCancelledAction = async (organizationId: string) => {
  return await isSubscriptionCancelled(organizationId);
};
