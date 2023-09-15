// import { PrismaClient } from "@prisma/client";
// // import { withAccelerate } from "@prisma/extension-accelerate";

// function makePrisma() {
//   return new PrismaClient({
//     datasources: { db: { url: process.env.DATABASE_URL } },
//     log: ["query", "info"],
//   });
// }

// const globalForPrisma = global as unknown as {
//   prisma: ReturnType<typeof makePrisma>;
// };

// export const prisma = globalForPrisma.prisma ?? makePrisma();

// if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = makePrisma();

import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } }, log: ["query", "info"] });

if (process.env.NODE_ENV !== "production") global.prisma = prisma;
