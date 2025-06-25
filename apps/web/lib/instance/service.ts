import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";

// Function to check if there are any users in the database
export const getIsFreshInstance = reactCache(async (): Promise<boolean> => {
  try {
    const userCount = await prisma.user.count();
    if (userCount === 0) return true;
    else return false;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
});

// Function to check if there are any organizations in the database
export const gethasNoOrganizations = reactCache(async (): Promise<boolean> => {
  try {
    const organizationCount = await prisma.organization.count();
    return organizationCount === 0;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
});
