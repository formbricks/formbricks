import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { PrismaClient } from "./generated/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prismaClientSingleton = (): PrismaClient => {
  return new PrismaClient({ adapter });
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

export const prisma: PrismaClient = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
