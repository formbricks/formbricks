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
  // TODO: Enable soft delete
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

    for (const membership of memberships) {
      if (membership.role === "owner") {
        if (membership.team.memberships.length > 1) {
          const newOwerner = membership.team.memberships.find((team) => team.user.id !== sessionUser.id);
          await prisma.membership.update({
            where: {
              userId_teamId: {
                teamId: membership.teamId,
                userId: newOwerner.user.id,
              },
            },
            data: {
              role: "owner",
            },
          });

          await prisma.membership.update({
            where: {
              userId_teamId: {
                teamId: membership.teamId,
                userId: sessionUser.id,
              },
            },
            data: {
              role: "admin",
            },
          });
        } else {
          await prisma.membership.delete({
            where: {
              userId_teamId: {
                userId: sessionUser.id,
                teamId: membership.teamId,
              },
            },
          });
        }
      } else {
        await prisma.membership.delete({
          where: {
            userId_teamId: {
              userId: sessionUser.id,
              teamId: membership.teamId,
            },
          },
        });
      }
    }
    // Delete user
    await prisma.user.delete({
      where: {
        id: sessionUser.id,
      },
    });
    return NextResponse.json({ deletedUser: sessionUser }, { status: 200 });
  } catch (error) {
    console.log(error.message);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
