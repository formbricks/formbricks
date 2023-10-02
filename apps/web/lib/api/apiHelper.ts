import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@formbricks/database";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { createHash } from "crypto";
import { NextApiRequest, NextApiResponse } from "next";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth";

export const hashApiKey = (key: string): string => createHash("sha256").update(key).digest("hex");

export const hasEnvironmentAccess = async (
  req: NextApiRequest,
  res: NextApiResponse,
  environmentId: string
) => {
  if (req.headers["x-api-key"]) {
    const ownership = await hasApiEnvironmentAccess(req.headers["x-api-key"].toString(), environmentId);
    if (!ownership) {
      return false;
    }
  } else {
    const user = await getSessionUser(req, res);
    if (!user) {
      return false;
    }
    const ownership = await hasUserEnvironmentAccess(user.id, environmentId);
    if (!ownership) {
      return false;
    }
  }
  return true;
};

export const getPlan = async (req, res) => {
  if (req.headers["x-api-key"]) {
    const apiKey = req.headers["x-api-key"].toString();
    const apiKeyData = await prisma.apiKey.findUnique({
      where: {
        hashedKey: hashApiKey(apiKey),
      },
      select: {
        environment: {
          select: {
            product: {
              select: {
                team: {
                  select: {
                    plan: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    return apiKeyData?.environment.product.team.plan || "free";
  } else {
    const user = await getSessionUser(req, res);
    return user && user.teams?.length > 0 ? user.teams[0].plan : "free";
  }
};

export const hasApiEnvironmentAccess = async (apiKey, environmentId) => {
  // write function to check if the API Key has access to the environment
  const apiKeyData = await prisma.apiKey.findUnique({
    where: {
      hashedKey: hashApiKey(apiKey),
    },
    select: {
      environmentId: true,
    },
  });

  if (apiKeyData?.environmentId === environmentId) {
    return true;
  }
  return false;
};

export const hasTeamAccess = async (user, teamId) => {
  const membership = await prisma.membership.findUnique({
    where: {
      userId_teamId: {
        userId: user.id,
        teamId: teamId,
      },
    },
  });
  if (membership) {
    return true;
  }
  return false;
};

export const getSessionUser = async (req?: NextApiRequest, res?: NextApiResponse) => {
  // check for session (browser usage)
  let session: Session | null;
  if (req && res) {
    session = await getServerSession(req, res, authOptions);
  } else {
    session = await getServerSession(authOptions);
  }
  if (session && "user" in session) return session.user;
};

export const isOwner = async (user, teamId) => {
  const membership = await prisma.membership.findUnique({
    where: {
      userId_teamId: {
        userId: user.id,
        teamId: teamId,
      },
    },
  });
  if (membership && membership.role === "owner") {
    return true;
  }
  return false;
};

export const isAdminOrOwner = async (user, teamId) => {
  const membership = await prisma.membership.findUnique({
    where: {
      userId_teamId: {
        userId: user.id,
        teamId: teamId,
      },
    },
  });
  if (membership && (membership.role === "admin" || membership.role === "owner")) {
    return true;
  }
  return false;
};
