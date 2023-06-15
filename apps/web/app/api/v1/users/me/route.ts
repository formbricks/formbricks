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

const teamHasAtLeastOneAdmin = (teamAdminMemberships) => teamAdminMemberships.length;

const deleteUser = async (userId: string) => {
  await prisma.user.delete({
    where: {
      id: userId,
    },
  });
};
const deleteMembership = async (teamId: string, userId: string) => {
  await prisma.membership.delete({
    where: {
      userId_teamId: {
        userId,
        teamId,
      },
    },
  });
};

// I created this type because I don't have access to prisma unums.
// TODO find a way to get access to prisma enums
type MembershipRole = "admin" | "owner";

const updateUserMembership = async (teamId: string, userId: string, role: MembershipRole) => {
  await prisma.membership.update({
    where: {
      userId_teamId: {
        userId,
        teamId,
      },
    },
    data: {
      role,
    },
  });
};

export async function DELETE() {
  try {
    const currentUser = await getSessionUser();

    if (!currentUser) {
      return new Response("Not authenticated", {
        status: 401,
      });
    }

    const currentUserMemberships = await prisma.membership.findMany({
      where: {
        userId: currentUser.id,
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            memberships: {
              select: {
                userId: true,
                role: true,
              },
              where: {
                role: "admin",
              },
            },
          },
        },
      },
    });

    for (const membership of currentUserMemberships) {
      if (membership.role === "owner") {
        if (teamHasAtLeastOneAdmin(membership.team.memberships)) {
          const firstAdmin = membership.team.memberships[0];
          await updateUserMembership(membership.teamId, firstAdmin.userId, "owner");
        } else {
          await deleteMembership(membership.teamId, currentUser.id);
        }
      } else {
        await deleteMembership(membership.teamId, currentUser.id);
      }
    }

    await deleteUser(currentUser.id);
    return NextResponse.json({ deletedUser: currentUser }, { status: 200 });
  } catch (error) {
    console.log("-----------------------------", error.message);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
