import "server-only";
import { compare, hash } from "bcryptjs";
import { AuthenticationError } from "@formbricks/types/errors";
import { can } from "@/lib/authorization";

export const hashPassword = async (password: string) => {
  const hashedPassword = await hash(password, 12);
  return hashedPassword;
};

export const verifyPassword = async (password: string, hashedPassword: string) => {
  const isValid = await compare(password, hashedPassword);
  return isValid;
};

export const hasOrganizationAccess = (userId: string, organizationId: string): Promise<boolean> =>
  can({ type: "user", id: userId }, "organization.read", { type: "organization", id: organizationId });

export const isManagerOrOwner = (userId: string, organizationId: string): Promise<boolean> =>
  can({ type: "user", id: userId }, "organization.manage", { type: "organization", id: organizationId });

export const isOwner = (userId: string, organizationId: string): Promise<boolean> =>
  can({ type: "user", id: userId }, "organization.write", { type: "organization", id: organizationId });

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
