"use server";

import { authOptions } from "@formbricks/lib/authOptions";
import { getServerSession } from "next-auth";
import { AuthorizationError } from "@formbricks/types/errors";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { canUserAccessTeam } from "@formbricks/lib/team/auth";
import { getTeam } from "@formbricks/lib/team/service";
import { getMonthlyActivePeopleCount } from "@formbricks/lib/person/service";
import { getMonthlyResponseCount } from "@formbricks/lib/response/service";

export async function getMonthlyCounts(teamId: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessTeam(session.user.id, teamId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const team = await getTeam(teamId);

  let peopleCount = 0;
  let responseCount = 0;

  for (const product of team.products) {
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

  const res = await fetch(WEBAPP_URL + "/api/billing/create-subscription", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      teamId: teamId,
      failureUrl: `${WEBAPP_URL}/environments/${environmentId}/settings/billing`,
      priceNickname,
    }),
  });
  if (!res.ok) {
    console.log("Error loading billing portal");
    return;
  }
  const data = await res.json();
  return data.data.url;
}

export async function manageSubscriptionAction(teamId: string, environmentId: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessTeam(session.user.id, teamId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const team = await getTeam(teamId);

  const res = await fetch(WEBAPP_URL + "/api/billing/create-customer-portal-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      stripeCustomerId: team.billing.stripeCustomerId,
      returnUrl: `${WEBAPP_URL}/environments/${environmentId}/settings/billing`,
    }),
  });
  if (!res.ok) {
    console.log("Error loading billing portal");
    return;
  }
  console.log("res", res);

  const {
    data: { sessionUrl },
  } = await res.json();
  return sessionUrl;
}

export async function removeSubscriptionAction(teamId: string, environmentId: string, itemNickname: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessTeam(session.user.id, teamId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const team = await getTeam(teamId);

  const res = await fetch(WEBAPP_URL + "/api/billing/remove-subscription", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      teamId: team.id,
      failureUrl: `${WEBAPP_URL}/environments/${environmentId}/settings/billing`,
      itemNickname,
    }),
  });
  if (!res.ok) {
    console.log("Error loading billing portal");
    return;
  }
  const data = await res.json();
  return data.data.url;
}
