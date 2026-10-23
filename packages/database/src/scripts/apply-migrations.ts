import { logger } from "@formbricks/logger";
import { parseMigrationPhase } from "./migration-phases";
import { applyMigrations } from "./migration-runner";

Promise.resolve()
  .then(() => applyMigrations(parseMigrationPhase(process.argv.slice(2))))
  .catch((error: unknown) => {
    logger.fatal(error, "Migration failed");
    process.exit(1);
  });
