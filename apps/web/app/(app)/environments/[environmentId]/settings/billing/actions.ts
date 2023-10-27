"use server";

import { authOptions } from "@formbricks/lib/authOptions";
import { getServerSession } from "next-auth";
import { AuthorizationError } from "@formbricks/types/errors";
import { TTeam } from "@formbricks/types/teams";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { canUserAccessTeam } from "@formbricks/lib/team/auth";
import { getTeam } from "@formbricks/lib/team/service";
import { getMonthlyActivePeopleCount } from "@formbricks/lib/person/service";
import { getMonthlyDisplayCount } from "@formbricks/lib/display/service";

export async function getBillingDetails(teamId: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessTeam(session.user.id, teamId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const team: any = await getTeam(teamId);

  const stripeCustomerId = team.subscription?.stripeCustomerId;

  if (!stripeCustomerId) {
    return {
      people: -1,
      display: -1,
    };
  }

  let peopleForTeam = 0;
  let displaysForTeam = 0;

  for (const product of team.products) {
    for (const environment of product.environments) {
      const peopleInThisEnvironment = await getMonthlyActivePeopleCount(environment.id);
      const displaysInThisEnvironment = await getMonthlyDisplayCount(environment.id);

      peopleForTeam += peopleInThisEnvironment;
      displaysForTeam += displaysInThisEnvironment;
    }
  }

  return {
    people: peopleForTeam,
    display: displaysForTeam,
  };
}

export async function upgradePlanAction(team: TTeam, environmentId: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessTeam(session.user.id, team.id);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const res = await fetch(WEBAPP_URL + "/api/billing/create-subscription", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      teamId: team.id,
      teamName: team.name,
      failureUrl: `${WEBAPP_URL}/environtments/${environmentId}/settings/billing`,
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
      stripeCustomerId: team.subscription?.stripeCustomerId,
      returnUrl: `${WEBAPP_URL}/environments/${environmentId}/settings/billing`,
    }),
  });
  if (!res.ok) {
    console.log("Error loading billing portal");
    return;
  }
  const {
    data: { sessionUrl },
  } = await res.json();
  return sessionUrl;
}
