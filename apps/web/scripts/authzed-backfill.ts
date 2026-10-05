import "server-only";
import { INVALID_CONFIGURATION_RESULT, INVALID_REQUEST_RESULT } from "./authzed-schema-results";

/**
 * Entry point for `pnpm authzed:backfill`.
 *
 * Deliberately thin: it hands argv to the covered command layer and reports an exit code. Parsing and
 * every guard live in `lib/authzed/backfill-cli.ts`, because `apps/web/scripts/**` is excluded from
 * coverage and the destructive-path guards must be tested.
 *
 * Usage:
 *   pnpm authzed:backfill
 *       Dry run over every organization. Reports drift, writes nothing. Exits 2 if drift remains.
 *   pnpm authzed:backfill --organization-id=<cuid>
 *       Dry run over one organization.
 *   pnpm authzed:backfill --apply
 *       Converge every organization from PostgreSQL. Reports relationships with no source record but
 *       leaves them in place.
 *   pnpm authzed:backfill --apply --prune --confirm-prune --scope=all \
 *       --expected-endpoint=<host:port>
 *       Also reconcile records observed only in SpiceDB, removing what PostgreSQL no longer holds.
 *   pnpm authzed:backfill --apply --after-organization-id=<cuid>
 *       Resume an interrupted run from the `lastOrganizationId` the previous run reported.
 *
 * Optional: --max-prune=<n> lowers the per-run prune cap (it can never raise it).
 *
 * Exit codes: 0 reconciled, 2 drift remains, 1 failed or misused.
 */

const writeResult = (result: object): void => {
  process.stdout.write(`${JSON.stringify(result)}\n`);
};

const run = async (): Promise<void> => {
  const originalConsoleError = console.error;
  let databaseLoaded = false;

  try {
    // Environment validation logs details before throwing. Suppress that duplicate output so this
    // automation-oriented command always emits exactly one sanitized JSON result.
    console.error = () => {};
    const { parseAuthzedBackfillCommand } = await import("../lib/authzed/backfill-cli-command");
    const command = parseAuthzedBackfillCommand(process.argv.slice(2));
    if (!command) {
      console.error = originalConsoleError;
      writeResult(INVALID_REQUEST_RESULT);
      process.exitCode = 1;
      return;
    }

    // Set before the import: loading the command module is what builds the Prisma client and its pool.
    databaseLoaded = true;
    const { runAuthzedBackfillCli } = await import("../lib/authzed/backfill-cli");
    console.error = originalConsoleError;
    process.exitCode = await runAuthzedBackfillCli(command);
  } catch {
    console.error = originalConsoleError;
    writeResult(INVALID_CONFIGURATION_RESULT);
    process.exitCode = 1;
  } finally {
    console.error = originalConsoleError;

    // The command closes its SpiceDB channel, but the PostgreSQL pool is process-wide. Its idle
    // connections are referenced sockets kept for `idleTimeoutMillis` (5 minutes by default), so
    // without this the process prints its result and then lingers until the pool times them out.
    if (databaseLoaded) {
      try {
        const { prisma } = await import("@formbricks/database");
        await prisma.$disconnect();
      } catch {
        // Cleanup failures must not replace the backfill's sanitized result or exit code.
      }
    }
  }
};

void run();
