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

  try {
    // Environment validation logs details before throwing. Suppress that duplicate output so this
    // automation-oriented command always emits exactly one sanitized JSON result.
    console.error = () => {};
    const { parseAuthzedBackfillCommand, runAuthzedBackfillCli } =
      await import("../lib/authzed/backfill-cli");
    console.error = originalConsoleError;

    const command = parseAuthzedBackfillCommand(process.argv.slice(2));
    if (!command) {
      writeResult(INVALID_REQUEST_RESULT);
      process.exitCode = 1;
      return;
    }

    process.exitCode = await runAuthzedBackfillCli(command);
  } catch {
    console.error = originalConsoleError;
    writeResult(INVALID_CONFIGURATION_RESULT);
    process.exitCode = 1;
  } finally {
    console.error = originalConsoleError;
  }
};

void run();
