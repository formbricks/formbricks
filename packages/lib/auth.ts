import { compare, hash } from "bcryptjs";
import { prisma } from "@formbricks/database";
import { AuthenticationError } from "@formbricks/types/errors";

export const hashPassword = async (password: string) => {
  const hashedPassword = await hash(password, 12);
  return hashedPassword;
};

export const verifyPassword = async (password: string, hashedPassword: string) => {
  const isValid = await compare(password, hashedPassword);
  return isValid;
};

export const hasOrganizationAccess = async (userId: string, organizationId: string): Promise<boolean> => {
  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
  });

  return !!membership;
};

export const isManagerOrOwner = async (userId: string, organizationId: string) => {
  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
  });

  if (membership && (membership.role === "owner" || membership.role === "manager")) {
    return true;
  }

  return false;
};

export const isOwner = async (userId: string, organizationId: string) => {
  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
  });

  if (membership && membership.role === "owner") {
    return true;
  }

  return false;
};

export const hasOrganizationAuthority = async (userId: string, organizationId: string) => {
  const hasAccess = await hasOrganizationAccess(userId, organizationId);
  if (!hasAccess) {
    throw new AuthenticationError("Not authorized");
  }

  const isManagerOrOwnerAccess = await isManagerOrOwner(userId, organizationId);
  if (!isManagerOrOwnerAccess) {
    throw new AuthenticationError("You are not the manager or owner of this organization");
  }

  return true;
};

export const hasOrganizationOwnership = async (userId: string, organizationId: string) => {
  const hasAccess = await hasOrganizationAccess(userId, organizationId);
  if (!hasAccess) {
    throw new AuthenticationError("Not authorized");
  }

  const isOwnerAccess = await isOwner(userId, organizationId);
  if (!isOwnerAccess) {
    throw new AuthenticationError("You are not the owner of this organization");
  }

  return true;
};
