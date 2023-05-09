import { PrismaClient } from "../generated";

declare global {
  var prisma: any;
}

export const prisma: PrismaClient =
  global.prisma || new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

if (process.env.NODE_ENV !== "production") global.prisma = prisma;
