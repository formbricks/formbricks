"use server";

import { getServerSession } from "next-auth";

import { StripePriceLookupKeys } from "@formbricks/ee/billing/lib/constants";
import { createCustomerPortalSession } from "@formbricks/ee/billing/lib/createCustomerPortalSession";
import { createSubscription } from "@formbricks/ee/billing/lib/createSubscription";
import { removeSubscription } from "@formbricks/ee/billing/lib/removeSubscription";
import { authOptions } from "@formbricks/lib/authOptions";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { canUserAccessTeam } from "@formbricks/lib/team/auth";
import { getTeam } from "@formbricks/lib/team/service";
import { AuthorizationError } from "@formbricks/types/errors";

export async function upgradePlanAction(
  teamId: string,
  environmentId: string,
  priceLookupKeys: StripePriceLookupKeys[]
) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessTeam(session.user.id, teamId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const subscriptionSession = await createSubscription(teamId, environmentId, priceLookupKeys);
  return subscriptionSession;
}

export async function manageSubscriptionAction(teamId: string, environmentId: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessTeam(session.user.id, teamId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const team = await getTeam(teamId);
  if (!team || !team.billing.stripeCustomerId)
    throw new AuthorizationError("You do not have an associated Stripe CustomerId");

  const sessionUrl = await createCustomerPortalSession(
    team.billing.stripeCustomerId,
    `${WEBAPP_URL}/environments/${environmentId}/settings/billing`
  );
  return sessionUrl;
}

export async function removeSubscriptionAction(
  teamId: string,
  environmentId: string,
  priceLookupKeys: StripePriceLookupKeys[]
) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessTeam(session.user.id, teamId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const removedSubscription = await removeSubscription(teamId, environmentId, priceLookupKeys);

  return removedSubscription.url;
}
