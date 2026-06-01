import { PrismaClient } from "./prisma";
import { createPrismaPgAdapter } from "./prisma-adapter";

const prismaClientSingleton = (): PrismaClient => {
  const { adapter } = createPrismaPgAdapter();

  return new PrismaClient({
    adapter,
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
