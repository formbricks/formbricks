import { getSessionUser } from "@/app/lib/api/apiHelper";
import { OrganizationRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@formbricks/database";
import { TOrganizationRole } from "@formbricks/types/memberships";

interface Membership {
  role: TOrganizationRole;
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

const updateUserMembership = async (organizationId: string, userId: string, role: OrganizationRole) => {
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

const getManagerMemberships = (memberships: Membership[]) =>
  memberships.filter((membership) => membership.role === OrganizationRole.manager);

const getOwnerMemberships = (memberships: Membership[]) =>
  memberships.filter((membership) => membership.role === OrganizationRole.owner);

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

      const organizationManagerMemberships = getManagerMemberships(organizationMemberships);
      const organizationOwnerMemberships = getOwnerMemberships(organizationMemberships);
      const organizationHasAtLeastOneManager = organizationManagerMemberships.length > 0;
      const organizationHasOnlyOneMember = organizationMemberships.length === 1;
      const organizationHasMoreThanOneOwner = organizationOwnerMemberships.length > 1;
      const currentUserIsOrganizationOwner = role === OrganizationRole.owner;

      if (organizationHasOnlyOneMember) {
        await deleteOrganization(organizationId);
      } else if (
        currentUserIsOrganizationOwner &&
        organizationHasAtLeastOneManager &&
        !organizationHasMoreThanOneOwner
      ) {
        const firstManager = organizationManagerMemberships[0];
        await updateUserMembership(organizationId, firstManager.userId, OrganizationRole.owner);
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
