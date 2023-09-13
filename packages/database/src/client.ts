import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

declare global {
  var prisma: any | undefined; // use any type for now. TODO: add support for Accelerate
}

export const prisma =
  global.prisma ||
  new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } }).$extends(withAccelerate());

if (process.env.NODE_ENV !== "production") global.prisma = prisma;
