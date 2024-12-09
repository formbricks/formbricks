 
import { PrismaClient } from "@prisma/client";
import { xmUserIdentification } from "./20241209104738_xm_user_identification/data-migration";
import { MigrationRunner } from "./runner";

const prisma = new PrismaClient();
const migrationRunner = new MigrationRunner(prisma);

export async function runDataMigrations(): Promise<void> {
  const migrations = [xmUserIdentification];

  try {
    await migrationRunner.runMigrations(migrations);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runDataMigrations().catch((error: unknown) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
