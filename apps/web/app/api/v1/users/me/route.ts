import { getSessionUser } from "@/lib/api/apiHelper";
import { MembershipRole } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { NextRequest, NextResponse } from "next/server";

interface Membership {
  role: MembershipRole;
  userId: string;
}

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

const deleteUser = async (userId: string) => {
  await prisma.user.delete({
    where: {
      id: userId,
    },
  });
};

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

const getAdminMemberships = (memberships: Membership[]) =>
  memberships.filter((membership) => membership.role === MembershipRole.admin);

const deleteTeam = async (teamId: string) => {
  await prisma.team.delete({
    where: {
      id: teamId,
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
            },
          },
        },
      },
    });

    for (const currentUserMembership of currentUserMemberships) {
      const teamMemberships = currentUserMembership.team.memberships;
      const role = currentUserMembership.role;
      const teamId = currentUserMembership.teamId;

      const teamAdminMemberships = getAdminMemberships(teamMemberships);
      const teamHasAtLeastOneAdmin = teamAdminMemberships.length > 0;
      const teamHasOnlyOneMember = teamMemberships.length === 1;
      const currentUserIsTeamOwner = role === MembershipRole.owner;

      if (teamHasOnlyOneMember) {
        await deleteTeam(teamId);
      } else if (currentUserIsTeamOwner && teamHasAtLeastOneAdmin) {
        const firstAdmin = teamAdminMemberships[0];
        await updateUserMembership(teamId, firstAdmin.userId, MembershipRole.owner);
      } else if (currentUserIsTeamOwner) {
        await deleteTeam(teamId);
      }
    }

    await deleteUser(currentUser.id);

    return NextResponse.json({ deletedUser: currentUser }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
