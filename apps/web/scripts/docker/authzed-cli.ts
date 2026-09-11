import "server-only";
import { configureAuthzedReleaseManifestUrl } from "../../lib/authzed/release-manifest";
import { configureCanonicalAuthzedSchemaUrl } from "../../lib/authzed/schema-source";
import { exitAfterStdoutFlush } from "../authzed-health-process";
import { INVALID_CONFIGURATION_RESULT, INVALID_REQUEST_RESULT } from "../authzed-schema-results";

// Operator commands have a single-JSON output contract. Suppress application logging before loading
// runtime modules so retries cannot add diagnostic lines to stdout.
process.env.LOG_LEVEL = "fatal";

configureCanonicalAuthzedSchemaUrl(import.meta.url, "./schema.zed");
configureAuthzedReleaseManifestUrl(import.meta.url, "./release-manifest.json");

const HEALTH_INVALID_CONFIGURATION_RESULT = {
  code: "authzed_internal",
  latencyMs: 0,
  retryable: false,
  status: "unhealthy",
} as const;

const HEALTH_INVALID_REQUEST_RESULT = {
  code: "authzed_invalid_request",
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
          console.error = originalConsoleError;
          writeResult(HEALTH_INVALID_REQUEST_RESULT);
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
      case "outbox": {
        const { parseAuthzedOutboxCliCommand } = await import("../../lib/authzed/outbox-cli-command");
        const outboxCommand = parseAuthzedOutboxCliCommand(args);

        if (!outboxCommand) {
          console.error = originalConsoleError;
          writeResult(INVALID_REQUEST_RESULT);
          process.exitCode = 1;
          return;
        }

        shouldCloseDatabase = true;
        const { runAuthzedOutboxCli } = await import("../../lib/authzed/outbox-cli");
        console.error = originalConsoleError;
        process.exitCode = await runAuthzedOutboxCli(outboxCommand);
        return;
      }
      case "upgrade": {
        const { parseAuthzedUpgradeCliCommand } = await import("../../lib/authzed/upgrade-cli-command");
        const upgradeCommand = parseAuthzedUpgradeCliCommand(args);

        if (!upgradeCommand) {
          console.error = originalConsoleError;
          writeResult(INVALID_REQUEST_RESULT);
          process.exitCode = 1;
          return;
        }

        shouldCloseDatabase = true;
        const { runAuthzedUpgradeCli } = await import("../../lib/authzed/upgrade-cli");
        console.error = originalConsoleError;
        process.exitCode = await runAuthzedUpgradeCli(upgradeCommand);
        return;
      }
      case "activation": {
        const { parseAuthzedActivationCliCommand } = await import("../../lib/authzed/activation-cli-command");
        const activationCommand = parseAuthzedActivationCliCommand(args);

        if (!activationCommand) {
          console.error = originalConsoleError;
          writeResult(INVALID_REQUEST_RESULT);
          process.exitCode = 1;
          return;
        }

        shouldCloseDatabase = true;
        const { runAuthzedActivationCli } = await import("../../lib/authzed/activation-cli");
        console.error = originalConsoleError;
        process.exitCode = await runAuthzedActivationCli(activationCommand);
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

void run().then(() => {
  if (process.argv[2] === "health") {
    exitAfterStdoutFlush(process.exitCode ?? 1);
  }
});
