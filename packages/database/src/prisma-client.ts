import { PrismaPg } from "@prisma/adapter-pg";
import { type Prisma, PrismaClient } from "@prisma/client";
import "dotenv/config";

interface CreatePrismaClientOptions extends Omit<Prisma.PrismaClientOptions, "adapter"> {
  connectionString?: string;
}

const getConnectionString = (connectionString?: string): string => {
  const dbUrl = connectionString ?? process.env.DATABASE_URL;

  if (!dbUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  return dbUrl;
};

export const createPrismaClient = (options?: CreatePrismaClientOptions): PrismaClient => {
  const adapter = new PrismaPg({ connectionString: getConnectionString(options?.connectionString) });
  const { connectionString: _connectionString, ...clientOptions } = options ?? {};

  return new PrismaClient({
    adapter,
    ...clientOptions,
  });
};
