"use server";

import { authOptions } from "@formbricks/lib/authOptions";
import { getServerSession } from "next-auth";
import { AuthorizationError } from "@formbricks/types/errors";
import { TTeam } from "@formbricks/types/teams";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { canUserAccessTeam } from "@formbricks/lib/team/auth";
import { getTeam } from "@formbricks/lib/team/service";

export async function getBillingDetails(teamId: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessTeam(session.user.id, teamId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const team = await getTeam(teamId);

  const res = await fetch(WEBAPP_URL + "/api/billing/get-usage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      stripeCustomerId: team.subscription?.stripeCustomerId,
    }),
  });
  if (!res.ok) {
    alert("Error loading billing portal");
    return {
      mtuUsage: -1,
      displayUsage: -1,
      amountLeft: -1,
      dueDate: -1,
    };
  }
  const { data } = await res.json();
  return {
    mtuUsage: data.data.mtuUsage,
    displayUsage: data.data.displayUsage,
    amountLeft: data.data.amountLeft,
    dueDate: data.data.dueDate,
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
      environmentId,
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
