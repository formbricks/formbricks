import { type PrismaClient } from "@prisma/client";
import { createPrismaClient } from "./prisma-client";

const prismaClientSingleton = (): PrismaClient => {
  return createPrismaClient(
    process.env.DEBUG === "1"
      ? {
          log: ["query", "info"],
        }
      : undefined
  );
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

export const prisma: PrismaClient = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
