import type { Prisma, PrismaClient } from "@prisma/client";

export interface DataMigrationContext {
  prisma: PrismaClient;
  tx: Omit<
    PrismaClient<Prisma.PrismaClientOptions, never>,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
  >;
}

export interface DataMigrationScript {
  id: string;
  name: string;
  run: (context: DataMigrationContext) => Promise<void>;
}
