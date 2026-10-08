import { createAppPrismaClientOptions } from "./client-options";
import { PrismaClient } from "./prisma";

const prismaClientSingleton = (): PrismaClient => {
  return new PrismaClient({
    ...createAppPrismaClientOptions(),
    ...(process.env.DEBUG === "1" && {
      log: ["query", "info"],
    }),
  });
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

export const prisma: PrismaClient = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
