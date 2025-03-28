import { getSessionUser } from "@/app/api/v1/management/me/lib/utils";
import { hashApiKey } from "@/modules/api/v2/management/lib/utils";
import { headers } from "next/headers";
import { prisma } from "@formbricks/database";

export const GET = async () => {
  const headersList = await headers();
  const apiKey = headersList.get("x-api-key");
  if (apiKey) {
    const apiKeyData = await prisma.apiKey.findUnique({
      where: {
        hashedKey: hashApiKey(apiKey),
      },
      select: {
        organization: {
          select: {
            id: true,
          },
        },
        apiKeyEnvironments: {
          select: {
            environment: {
              select: { id: true },
            },
            permission: true,
          },
        },
      },
    });
    if (!apiKeyData) {
      return new Response("Not authenticated", {
        status: 401,
      });
    }
    return Response.json(apiKeyData.organization);
  } else {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return new Response("Not authenticated", {
        status: 401,
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: sessionUser.id,
      },
    });

    return Response.json(user);
  }
};
