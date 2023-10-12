import { prisma } from "@formbricks/database";
import { AuthenticationError } from "@formbricks/types/v1/errors";
import { compare, hash } from "bcryptjs";

export async function hashPassword(password: string) {
  const hashedPassword = await hash(password, 12);
  return hashedPassword;
}

export async function verifyPassword(password: string, hashedPassword: string) {
  const isValid = await compare(password, hashedPassword);
  return isValid;
}

export const hasTeamAccess = async (userId: string, teamId: string) => {
  const membership = await prisma.membership.findUnique({
    where: {
      userId_teamId: {
        userId,
        teamId,
      },
    },
  });

  if (membership) {
    return true;
  }

  return false;
};

export const isAdminOrOwner = async (userId: string, teamId: string) => {
  const membership = await prisma.membership.findUnique({
    where: {
      userId_teamId: {
        userId,
        teamId,
      },
    },
  });

  if (membership && (membership.role === "admin" || membership.role === "owner")) {
    return true;
  }

  return false;
};

export const isOwner = async (userId: string, teamId: string) => {
  const membership = await prisma.membership.findUnique({
    where: {
      userId_teamId: {
        userId,
        teamId,
      },
    },
  });

  if (membership && membership.role === "owner") {
    return true;
  }

  return false;
};

export const hasTeamAuthority = async (userId: string, teamId: string) => {
  const hasAccess = await hasTeamAccess(userId, teamId);
  if (!hasAccess) {
    throw new AuthenticationError("Not authorized");
  }

  const isAdminOrOwnerAccess = await isAdminOrOwner(userId, teamId);
  if (!isAdminOrOwnerAccess) {
    throw new AuthenticationError("You are not the admin or owner of this team");
  }

  return true;
};

export const hasTeamOwnership = async (userId: string, teamId: string) => {
  const hasAccess = await hasTeamAccess(userId, teamId);
  if (!hasAccess) {
    throw new AuthenticationError("Not authorized");
  }

  const isOwnerAccess = await isOwner(userId, teamId);
  if (!isOwnerAccess) {
    throw new AuthenticationError("You are not the owner of this team");
  }

  return true;
};
