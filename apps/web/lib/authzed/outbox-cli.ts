import "server-only";
import { closeAuthzedClient } from "./client";
import type { TAuthzedOutboxCliCommand } from "./outbox-cli-command";
import { drainAuthzedOutbox } from "./outbox-processor";
import { getAuthzedOutboxStatus, replayAuthzedOutboxDeadLetters } from "./outbox-repository";
import type { TAuthzedOutboxStatus } from "./outbox-types";

type TOutboxCliDependencies = Readonly<{
  closeClient: () => void;
  drain: typeof drainAuthzedOutbox;
  replay: typeof replayAuthzedOutboxDeadLetters;
  status: typeof getAuthzedOutboxStatus;
  writeOutput: (output: string) => void;
}>;

const defaultDependencies: TOutboxCliDependencies = {
  closeClient: closeAuthzedClient,
  drain: drainAuthzedOutbox,
  replay: replayAuthzedOutboxDeadLetters,
  status: getAuthzedOutboxStatus,
  writeOutput: (output) => process.stdout.write(output),
};

const getHealthStatus = (status: TAuthzedOutboxStatus): "critical" | "warning" | "healthy" => {
  if (status.deadLettered > 0 || status.revocationsPastCritical > 0) {
    return "critical";
  }

  if (status.revocationsPastWarning > 0) {
    return "warning";
  }

  return "healthy";
};

export const runAuthzedOutboxCli = async (
  command: TAuthzedOutboxCliCommand,
  overrides: Partial<TOutboxCliDependencies> = {}
): Promise<number> => {
  const dependencies = { ...defaultDependencies, ...overrides };
  let result: object;
  let exitCode = 1;

  try {
    switch (command.action) {
      case "status": {
        const status = await dependencies.status();
        const health = getHealthStatus(status);
        result = { ...status, status: health };
        exitCode = health === "healthy" ? 0 : 2;
        break;
      }
      case "drain": {
        const drainResult = await dependencies.drain(command.maxBatches);
        result = drainResult;
        exitCode = drainResult.status === "drained" ? 0 : 2;
        break;
      }
      case "replay": {
        result = { replayed: await dependencies.replay(), status: "replayed" };
        exitCode = 0;
        break;
      }
    }
  } catch {
    result = { code: "authzed_internal", retryable: false, status: "failed" };
    exitCode = 1;
  } finally {
    dependencies.closeClient();
  }

  dependencies.writeOutput(`${JSON.stringify(result)}\n`);
  return exitCode;
};
