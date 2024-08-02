import { getSessionUser, hashApiKey } from "@/app/lib/api/apiHelper";
import { headers } from "next/headers";
import { prisma } from "@formbricks/database";

export const GET = async () => {
  const headersList = headers();
  const apiKey = headersList.get("x-api-key");
  if (apiKey) {
    const apiKeyData = await prisma.apiKey.findUnique({
      where: {
        hashedKey: hashApiKey(apiKey),
      },
      select: {
        environment: {
          select: {
            id: true,
            createdAt: true,
            updatedAt: true,
            type: true,
            product: {
              select: {
                id: true,
                name: true,
              },
            },
            appSetupCompleted: true,
            websiteSetupCompleted: true,
          },
        },
      },
    });
    if (!apiKeyData) {
      return new Response("Not authenticated", {
        status: 401,
      });
    }
    return Response.json(apiKeyData.environment);
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
