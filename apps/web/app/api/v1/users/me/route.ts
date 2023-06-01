import { getSessionUser } from "@/lib/api/apiHelper";
import { prisma } from "@formbricks/database";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
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

export async function PUT(request: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return new Response("Not authenticated", {
      status: 401,
    });
  }
  const body = await request.json();

  const user = await prisma.user.update({
    where: {
      email: sessionUser.email,
    },
    data: body,
  });

  return NextResponse.json(user);
}
