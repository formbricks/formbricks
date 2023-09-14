import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

function makePrisma() {
  return new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
  }).$extends(withAccelerate());
}

const globalForPrisma = global as unknown as {
  prisma: ReturnType<typeof makePrisma>;
};

export const prisma = globalForPrisma.prisma ?? makePrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = makePrisma();
