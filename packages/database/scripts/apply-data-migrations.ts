import { PrismaClient } from "@prisma/client";
import { xmSegmentMigration } from "../data-migrations/20241021123456_xm_segment_migration/data-migration";
import { xmUserIdentification } from "../data-migrations/20241209104738_xm_user_identification/data-migration";
import { xmAttributeRemoval } from "../data-migrations/20241209111404_xm_attribute_removal/data-migration";
import { updateOrgLimits } from "../data-migrations/20241209111525_update_org_limits/data-migration";
import { productRevamp } from "../data-migrations/20241209111725_product_revamp/data-migration";
import { MigrationRunner } from "../types/migration-runner";

const prisma = new PrismaClient();
const migrationRunner = new MigrationRunner(prisma);

export async function applyDataMigrations(): Promise<void> {
  const dataMigrations = [
    xmUserIdentification,
    xmSegmentMigration,
    xmAttributeRemoval,
    updateOrgLimits,
    productRevamp,
  ];

  try {
    await migrationRunner.runMigrations(dataMigrations);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

applyDataMigrations().catch((error: unknown) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
