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

export async function DELETE() {
  try {
    const sessionUser = await getSessionUser();

    if (!sessionUser) {
      return new Response("Not authenticated", {
        status: 401,
      });
    }

    const memberships = await prisma.membership.findMany({
      where: {
        userId: sessionUser.id,
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            memberships: {
              select: {
                user: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    memberships.forEach(() => async (membership) => {
      if (membership.role === "owner") {
        if (membership.team.memberships.length > 1) {
          const newOwerner = membership.team.memberships.find((team) => team.user.id !== sessionUser.id);

          await prisma.membership.update({
            where: {
              teamId: membership.teamId,
              userId: newOwerner.user.id,
            },
            data: {
              role: "owner",
            },
          });

          await prisma.membership.update({
            where: {
              teamId: membership.teamId,
              userId: sessionUser.id,
            },
            data: {
              role: "admin",
            },
          });
        } else {
          await prisma.membership.delete({
            where: {
              teamId: membership.teamId,
              userId: sessionUser.id,
            },
          });
        }
      } else {
        await prisma.membership.delete({
          where: {
            teamId: membership.teamId,
            userId: sessionUser.id,
          },
        });
      }
    });

    // TODO  Logout user before deleting account

    // Delete user
    await prisma.user.delete({
      where: {
        id: sessionUser.id,
      },
    });

    return NextResponse.json({ name: memberships });
  } catch (error) {
    // TODO handle this error
    console.log("error.message =>>>>>>>>>>>>>>>>>>>", error.message);
  }
}
