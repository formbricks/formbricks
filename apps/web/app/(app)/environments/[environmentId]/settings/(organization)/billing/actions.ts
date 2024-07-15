"use server";

import { getServerSession } from "next-auth";
import { createCustomerPortalSession } from "@formbricks/ee/billing/lib/create-customer-portal-session";
import { createSubscription } from "@formbricks/ee/billing/lib/create-subscription";
import { isSubscriptionCancelled } from "@formbricks/ee/billing/lib/is-subscription-cancelled";
import { authOptions } from "@formbricks/lib/authOptions";
import { STRIPE_PRICE_LOOKUP_KEYS } from "@formbricks/lib/constants";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { canUserAccessOrganization } from "@formbricks/lib/organization/auth";
import { getOrganization } from "@formbricks/lib/organization/service";
import { AuthorizationError, ResourceNotFoundError } from "@formbricks/types/errors";

export const upgradePlanAction = async (
  organizationId: string,
  environmentId: string,
  priceLookupKey: STRIPE_PRICE_LOOKUP_KEYS
) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessOrganization(session.user.id, organizationId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const organization = await getOrganization(organizationId);
  if (!organization) {
    throw new ResourceNotFoundError("organization", organizationId);
  }

  const membership = await getMembershipByUserIdOrganizationId(session.user.id, organizationId);

  if (membership?.role === "owner" || membership?.role === "admin") {
    const subscriptionSession = await createSubscription(organizationId, environmentId, priceLookupKey);

    return subscriptionSession;
  } else {
    throw new AuthorizationError("Only organization owner or admin can upgrade plan");
  }
};

export const manageSubscriptionAction = async (organizationId: string, environmentId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessOrganization(session.user.id, organizationId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const organization = await getOrganization(organizationId);
  if (!organization) {
    throw new ResourceNotFoundError("organization", organizationId);
  }

  if (!organization.billing.stripeCustomerId) {
    throw new AuthorizationError("You do not have an associated Stripe CustomerId");
  }

  const membership = await getMembershipByUserIdOrganizationId(session.user.id, organizationId);

  if (membership?.role === "owner" || membership?.role === "admin") {
    const sessionUrl = await createCustomerPortalSession(
      organization.billing.stripeCustomerId,
      `${WEBAPP_URL}/environments/${environmentId}/settings/billing`
    );
    return sessionUrl;
  } else {
    throw new AuthorizationError("Only organization owner or admin can upgrade plan");
  }
};

export const isSubscriptionCancelledAction = async (organizationId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessOrganization(session.user.id, organizationId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const membership = await getMembershipByUserIdOrganizationId(session.user.id, organizationId);
  if (membership?.role === "owner" || membership?.role === "admin") {
    return await isSubscriptionCancelled(organizationId);
  } else {
    throw new AuthorizationError("Only organization owner or admin can upgrade plan");
  }
};
