"use server";

import { Team } from "@prisma/client";
import { getServerSession } from "next-auth";

import { authOptions } from "@formbricks/lib/authOptions";
import { SHORT_URL_BASE, WEBAPP_URL } from "@formbricks/lib/constants";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { createMembership } from "@formbricks/lib/membership/service";
import { createProduct } from "@formbricks/lib/product/service";
import { createShortUrl } from "@formbricks/lib/shortUrl/service";
import { createTeam, getTeamByEnvironmentId } from "@formbricks/lib/team/service";
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

export async function createTeamAction(teamName: string): Promise<Team> {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const newTeam = await createTeam({
    name: teamName,
  });

  await createMembership(newTeam.id, session.user.id, {
    role: "owner",
    accepted: true,
  });

  await createProduct(newTeam.id, {
    name: "My Product",
  });

  return newTeam;
}

export const createProductAction = async (environmentId: string, productName: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await hasUserEnvironmentAccess(session.user.id, environmentId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const team = await getTeamByEnvironmentId(environmentId);
  if (!team) throw new ResourceNotFoundError("Team from environment", environmentId);

  const product = await createProduct(team.id, {
    name: productName,
  });

  // get production environment
  const productionEnvironment = product.environments.find((environment) => environment.type === "production");
  if (!productionEnvironment) throw new ResourceNotFoundError("Production environment", environmentId);

  return productionEnvironment;
};
