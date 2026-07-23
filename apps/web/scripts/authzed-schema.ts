import "server-only";

const INVALID_REQUEST_RESULT = {
  code: "authzed_invalid_request",
  retryable: false,
  status: "failed",
} as const;

const INVALID_CONFIGURATION_RESULT = {
  code: "authzed_internal",
  retryable: false,
  status: "failed",
} as const;

type TSchemaCommand =
  | Readonly<{ action: "check" }>
  | Readonly<{ action: "apply"; expectedCurrentDigest?: string }>;

const parseCommand = (args: string[]): TSchemaCommand | undefined => {
  if (args.length === 1 && args[0] === "check") {
    return { action: "check" };
  }

  if (args[0] !== "apply") {
    return undefined;
  }

  if (args.length === 1) {
    return { action: "apply" };
  }

  if (
    args.length === 3 &&
    args[1] === "--expected-current-digest" &&
    /^sha256:[a-f0-9]{64}$/.test(args[2] ?? "")
  ) {
    return { action: "apply", expectedCurrentDigest: args[2] };
  }

  return undefined;
};

const writeResult = (result: object): void => {
  process.stdout.write(`${JSON.stringify(result)}\n`);
};

const run = async (): Promise<void> => {
  const command = parseCommand(process.argv.slice(2));

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
