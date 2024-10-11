import { getSessionUser } from "@/app/lib/api/apiHelper";
import { MembershipRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@formbricks/database";

interface Membership {
  role: MembershipRole;
  userId: string;
}

export const GET = async () => {
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
};

export const PUT = async (request: NextRequest) => {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return new Response("Not authenticated", {
      status: 401,
    });
  }
  const body = await request.json();

  const user = await prisma.user.update({
    where: {
      id: sessionUser.id,
    },
    data: body,
  });

  return Response.json(user);
};

const deleteUser = async (userId: string) => {
  await prisma.user.delete({
    where: {
      id: userId,
    },
  });
};

const updateUserMembership = async (organizationId: string, userId: string, role: MembershipRole) => {
  await prisma.membership.update({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
    data: {
      role,
    },
  });
};

const getAdminMemberships = (memberships: Membership[]) =>
  memberships.filter((membership) => membership.role === MembershipRole.admin);

const deleteOrganization = async (organizationId: string) => {
  await prisma.organization.delete({
    where: {
      id: organizationId,
    },
  });
};

export const DELETE = async () => {
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
        organization: {
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
      const organizationMemberships = currentUserMembership.organization.memberships;
      const role = currentUserMembership.role;
      const organizationId = currentUserMembership.organizationId;

      const organizationAdminMemberships = getAdminMemberships(organizationMemberships);
      const organizationHasAtLeastOneAdmin = organizationAdminMemberships.length > 0;
      const organizationHasOnlyOneMember = organizationMemberships.length === 1;
      const currentUserIsOrganizationOwner = role === MembershipRole.owner;

      if (organizationHasOnlyOneMember) {
        await deleteOrganization(organizationId);
      } else if (currentUserIsOrganizationOwner && organizationHasAtLeastOneAdmin) {
        const firstAdmin = organizationAdminMemberships[0];
        await updateUserMembership(organizationId, firstAdmin.userId, MembershipRole.owner);
      } else if (currentUserIsOrganizationOwner) {
        await deleteOrganization(organizationId);
      }
    }

    await deleteUser(currentUser.id);

    return Response.json({ deletedUser: currentUser }, { status: 200 });
  } catch (error) {
    return Response.json({ message: error.message }, { status: 500 });
  }
};
