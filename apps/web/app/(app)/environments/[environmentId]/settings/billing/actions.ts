"use server";

import { authOptions } from "@formbricks/lib/authOptions";
import { getServerSession } from "next-auth";
import { AuthorizationError } from "@formbricks/types/errors";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { canUserAccessTeam } from "@formbricks/lib/team/auth";
import { getTeam } from "@formbricks/lib/team/service";
import { getMonthlyActivePeopleCount } from "@formbricks/lib/person/service";
import { getMonthlyResponseCount } from "@formbricks/lib/response/service";
import createSubscription from "@formbricks/ee/billing/api/create-subscription";
import createCustomerPortalSession from "@formbricks/ee/billing/api/create-customer-portal-session";
import removeSubscription from "@formbricks/ee/billing/api/remove-subscription";
import { getProducts } from "@formbricks/lib/product/service";

export async function getMonthlyCounts(teamId: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessTeam(session.user.id, teamId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  let peopleCount = 0;
  let responseCount = 0;

  const products = await getProducts(teamId);
  for (const product of products) {
    for (const environment of product.environments) {
      const peopleInThisEnvironment = await getMonthlyActivePeopleCount(environment.id);
      const responsesInThisEnvironment = await getMonthlyResponseCount(environment.id);

      peopleCount += peopleInThisEnvironment;
      responseCount += responsesInThisEnvironment;
    }
  }

  return {
    people: peopleCount,
    response: responseCount,
  };
}

export async function upgradePlanAction(teamId: string, environmentId: string, priceNickname: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessTeam(session.user.id, teamId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const subscriptionSession = await createSubscription(teamId, environmentId, priceNickname);

  return subscriptionSession.url;
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

export async function removeSubscriptionAction(teamId: string, environmentId: string, itemNickname: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessTeam(session.user.id, teamId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const removedSubscription = await removeSubscription(
    teamId,
    `${WEBAPP_URL}/environments/${environmentId}/settings/billing`,
    itemNickname
  );

  return removedSubscription.url;
}
