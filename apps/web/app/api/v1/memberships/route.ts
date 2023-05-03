import { getSessionUser } from "@/lib/api/apiHelper";
import { prisma } from "@formbricks/database";
import { NextResponse } from "next/server";

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return new Response("Not authenticated", {
      status: 401,
    });
  }

  // get memberships
  const memberships = await prisma.membership.findMany({
    where: {
      userId: sessionUser.id,
    },
  });

  return NextResponse.json(memberships);
}
