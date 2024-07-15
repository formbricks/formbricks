import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

const prismaClientSingleton = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
  ...(process.env.DEBUG === "1" && {
    log: ["query", "info"],
  }),
}).$extends(withAccelerate());

const globalForPrisma = globalThis as unknown as {
  prisma: typeof prismaClientSingleton | undefined;
};

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
