import { logger } from "@formbricks/logger";
import { getPendingMigrations } from "./migration-check";

// Startup gate for the web runtime image, which no longer bundles the Prisma CLI
// and therefore cannot migrate itself (ENG-1153). Migrations run in the dedicated
// formbricks-migrate image (Helm Job / compose one-shot / manual step) BEFORE the
// web app starts. This verifies that actually happened and fails fast — with a
// clear message and a non-zero exit — rather than letting the app serve traffic
// against an empty or half-migrated schema.
getPendingMigrations()
  .then(({ schema, data }) => {
    const pendingCount = schema.length + data.length;
    if (pendingCount === 0) {
      logger.info("Database schema is up to date; all migrations applied.");
      return;
    }

    logger.fatal(
      { pendingSchemaMigrations: schema, pendingDataMigrations: data },
      `Database schema is not up to date: ${pendingCount.toString()} pending migration(s). ` +
        "Run the formbricks-migrate image/step before starting the web app."
    );
    process.exit(1);
  })
  .catch((error: unknown) => {
    logger.fatal(
      error,
      "Could not verify database migration state (database unreachable or not initialized). " +
        "Run the formbricks-migrate image/step before starting the web app."
    );
    process.exit(1);
  });
