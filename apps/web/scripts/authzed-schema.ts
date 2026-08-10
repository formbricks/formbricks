import "server-only";
import { INVALID_CONFIGURATION_RESULT, INVALID_REQUEST_RESULT } from "./authzed-schema-results";

const writeResult = (result: object): void => {
  process.stdout.write(`${JSON.stringify(result)}\n`);
};

const run = async (): Promise<void> => {
  const { parseAuthzedSchemaCliCommand } = await import("../lib/authzed/schema-cli-command");
  const command = parseAuthzedSchemaCliCommand(process.argv.slice(2));

  if (!command) {
    writeResult(INVALID_REQUEST_RESULT);
    process.exitCode = 1;
    return;
  }

  const originalConsoleError = console.error;

  try {
    // Environment validation logs details before throwing. Suppress that duplicate output here so this
    // automation-oriented command always emits exactly one sanitized JSON result.
    console.error = () => {};
    const { runAuthzedSchemaCli } = await import("../lib/authzed/schema-cli");
    console.error = originalConsoleError;

    process.exitCode = await runAuthzedSchemaCli(command);
  } catch {
    console.error = originalConsoleError;
    writeResult(INVALID_CONFIGURATION_RESULT);
    process.exitCode = 1;
  } finally {
    console.error = originalConsoleError;
  }
};

void run();
