import { PRISMA_GLOBAL_OMIT } from "./client-options";
import { recordDatabaseOperationalError } from "./operational-error-context";
import { PrismaClient } from "./prisma";
import { createPrismaPgAdapter } from "./prisma-adapter";

const prismaClientSingleton = (): PrismaClient => {
  const { adapter } = createPrismaPgAdapter();

  const client = new PrismaClient({
    adapter,
    omit: PRISMA_GLOBAL_OMIT,
    ...(process.env.DEBUG === "1" && {
      log: ["query", "info"],
    }),
  });

  const extendedClient = client.$extends({
    name: "authzed-mutation-fence",
    query: {
      async $allOperations({ args, query }) {
        try {
          const result: unknown = await query(args);
          return result;
        } catch (error) {
          const operationalError = recordDatabaseOperationalError(error);
          if (operationalError) throw operationalError;
          throw error;
        }
      },
    },
  });

  // Prisma 7's generated extension type changes the recursive `$transaction` callback type even
  // when an extension adds no public fields. Runtime model/query methods remain the same, so retain
  // the package's established PrismaClient facade instead of leaking that incompatible type through
  // every service and TransactionClient annotation in the application.
  return extendedClient as unknown as PrismaClient;
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

export const prisma: PrismaClient = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
