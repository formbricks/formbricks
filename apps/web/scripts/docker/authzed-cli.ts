import "server-only";
import { configureCanonicalAuthzedSchemaUrl } from "../../lib/authzed/schema-source";
import { INVALID_CONFIGURATION_RESULT, INVALID_REQUEST_RESULT } from "../authzed-schema-results";

configureCanonicalAuthzedSchemaUrl(import.meta.url, "./schema.zed");

const HEALTH_INVALID_CONFIGURATION_RESULT = {
  code: "authzed_internal",
  latencyMs: 0,
  retryable: false,
  status: "unhealthy",
} as const;

const writeResult = (result: object): void => {
  process.stdout.write(`${JSON.stringify(result)}\n`);
};

const closeDatabase = async (): Promise<void> => {
  const { prisma } = await import("@formbricks/database");

  await prisma.$disconnect();
};

const run = async (): Promise<void> => {
  const [command, ...args] = process.argv.slice(2);
  const originalConsoleError = console.error;
  let shouldCloseDatabase = false;

  try {
    // Environment validation writes its own diagnostics before throwing. The operator command contract
    // is one sanitized JSON document, so suppress that duplicate output while loading runtime modules.
    console.error = () => {};

    switch (command) {
      case "health": {
        if (args.length !== 0) {
          writeResult(INVALID_REQUEST_RESULT);
          process.exitCode = 1;
          return;
        }

        const { runAuthzedHealthCli } = await import("../../lib/authzed/cli");
        console.error = originalConsoleError;
        process.exitCode = await runAuthzedHealthCli();
        return;
      }
      case "schema": {
        const { parseAuthzedSchemaCliCommand } = await import("../../lib/authzed/schema-cli-command");
        const schemaCommand = parseAuthzedSchemaCliCommand(args);

        if (!schemaCommand) {
          console.error = originalConsoleError;
          writeResult(INVALID_REQUEST_RESULT);
          process.exitCode = 1;
          return;
        }

        const { runAuthzedSchemaCli } = await import("../../lib/authzed/schema-cli");
        console.error = originalConsoleError;
        process.exitCode = await runAuthzedSchemaCli(schemaCommand);
        return;
      }
      case "backfill": {
        const { parseAuthzedBackfillCommand } = await import("../../lib/authzed/backfill-cli-command");
        const backfillCommand = parseAuthzedBackfillCommand(args);

        if (!backfillCommand) {
          console.error = originalConsoleError;
          writeResult(INVALID_REQUEST_RESULT);
          process.exitCode = 1;
          return;
        }

        shouldCloseDatabase = true;
        const { runAuthzedBackfillCli } = await import("../../lib/authzed/backfill-cli");
        console.error = originalConsoleError;
        process.exitCode = await runAuthzedBackfillCli(backfillCommand);
        return;
      }
      default:
        console.error = originalConsoleError;
        writeResult(INVALID_REQUEST_RESULT);
        process.exitCode = 1;
    }
  } catch {
    console.error = originalConsoleError;
    writeResult(command === "health" ? HEALTH_INVALID_CONFIGURATION_RESULT : INVALID_CONFIGURATION_RESULT);
    process.exitCode = 1;
  } finally {
    console.error = originalConsoleError;

    if (shouldCloseDatabase) {
      try {
        await closeDatabase();
      } catch {
        // Cleanup failures must not replace the command's sanitized result or exit code.
      }
    }
  }
};

void run();
