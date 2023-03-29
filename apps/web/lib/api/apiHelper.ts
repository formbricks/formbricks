import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@formbricks/database";
import { createHash } from "crypto";
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";

export const hashApiKey = (key: string): string => createHash("sha256").update(key).digest("hex");

export const hasOwnership = async (model, session, id) => {
  try {
    const entity = await prisma[model].findUnique({
      where: { id: id },
      include: {
        user: {
          select: { email: true },
        },
      },
    });
    if (entity.user.email === session.email) {
      return true;
    } else {
      return false;
    }
  } catch (e) {
    console.error(`can't verify ownership: ${e}`);
    return false;
  }
};

export const hasEnvironmentAccess = async (user, environmentId) => {
  const environment = await prisma.environment.findUnique({
    where: {
      id: environmentId,
    },
    select: {
      product: {
        select: {
          team: {
            select: {
              memberships: {
                select: {
                  userId: true,
                },
              },
            },
          },
        },
      },
    },
  });
  const environmentUsers = environment?.product.team.memberships.map((member) => member.userId) || [];
  if (environmentUsers.includes(user.id)) {
    return true;
  }
  return false;
};

export const getSessionOrUser = async (req: NextApiRequest, res: NextApiResponse) => {
  // check for session (browser usage)
  let session: any = await getServerSession(req, res, authOptions);
  if (session && "user" in session) return session.user;
  // check for api key
  if (req.headers["x-api-key"]) {
    const apiKey = await prisma.apiKey.findUnique({
      where: {
        hashedKey: hashApiKey(req.headers["x-api-key"].toString()),
      },
      include: {
        user: true,
      },
    });
    if (apiKey && apiKey.user) {
      return apiKey.user;
    }
  }
};
