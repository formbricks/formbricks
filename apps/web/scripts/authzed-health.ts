import "server-only";

const INVALID_CONFIGURATION_RESULT = {
  code: "authzed_internal",
  latencyMs: 0,
  retryable: false,
  status: "unhealthy",
} as const;

const run = async (): Promise<void> => {
  const originalConsoleError = console.error;

  try {
    // Environment validation logs details before throwing. Suppress that duplicate output here so this
    // automation-oriented command always emits exactly one sanitized JSON result.
    console.error = () => {};
    const { runAuthzedHealthCli } = await import("../lib/authzed/cli");
    console.error = originalConsoleError;

    process.exitCode = await runAuthzedHealthCli();
  } catch {
    console.error = originalConsoleError;
    process.stdout.write(`${JSON.stringify(INVALID_CONFIGURATION_RESULT)}\n`);
    process.exitCode = 1;
  } finally {
    console.error = originalConsoleError;
  }
};

void run();
