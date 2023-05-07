import { getSessionUser, hashApiKey } from "@/lib/api/apiHelper";
import { prisma } from "@formbricks/database";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const headersList = headers();
  const apiKey = headersList.get("x-api-key");
  if (apiKey) {
    const apiKeyData = await prisma.apiKey.findUnique({
      where: {
        hashedKey: hashApiKey(apiKey),
      },
      select: {
        environment: true,
      },
    });
    if (!apiKeyData) {
      return new Response("Not authenticated", {
        status: 401,
      });
    }
    return NextResponse.json(apiKeyData.environment);
  } else {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return new Response("Not authenticated", {
        status: 401,
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        email: sessionUser.email,
      },
    });

    return NextResponse.json(user);
  }
}
