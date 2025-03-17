import { logger } from "@formbricks/logger";
import { applyMigrations } from "./migration-runner";

applyMigrations().catch((error: unknown) => {
  logger.fatal(error, "Migration failed:");
  process.exit(1);
});
