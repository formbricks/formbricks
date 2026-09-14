import "server-only";
import { INVALID_CONFIGURATION_RESULT, INVALID_REQUEST_RESULT } from "./authzed-schema-results";

// Development counterpart of the image's `formbricks-authzed upgrade` command.
process.env.LOG_LEVEL = "fatal";

const run = async (): Promise<void> => {
  const originalConsoleError = console.error;
  let databaseLoaded = false;
  try {
    console.error = () => {};
    const { parseAuthzedUpgradeCliCommand } = await import("../lib/authzed/upgrade-cli-command");
    const command = parseAuthzedUpgradeCliCommand(process.argv.slice(2));
    if (!command) {
      process.stdout.write(`${JSON.stringify(INVALID_REQUEST_RESULT)}\n`);
      process.exitCode = 1;
      return;
    }
    const { runAuthzedUpgradeCli } = await import("../lib/authzed/upgrade-cli");
    databaseLoaded = true;
    console.error = originalConsoleError;
    process.exitCode = await runAuthzedUpgradeCli(command);
  } catch {
    process.stdout.write(`${JSON.stringify(INVALID_CONFIGURATION_RESULT)}\n`);
    process.exitCode = 1;
  } finally {
    console.error = originalConsoleError;
    if (databaseLoaded) {
      try {
        const { prisma } = await import("@formbricks/database");
        await prisma.$disconnect();
      } catch {
        // Cleanup must not replace the sanitized command result.
      }
    }
  }
};

void run();
