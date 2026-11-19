import { loggableError, logger } from "@formbricks/logger";
import { parseMigrationPhase } from "./migration-phases";
import { applyMigrations } from "./migration-runner";

Promise.resolve()
  .then(() => applyMigrations(parseMigrationPhase(process.argv.slice(2))))
  .catch((error: unknown) => {
    // A data migration error can quote row values, so only its name and frames are logged.
    logger.fatal(loggableError(error), "Migration failed");
    process.exit(1);
  });
