import "server-only";
import { closeAuthzedClient } from "./client";
import { AUTHZED_ERROR_CODES } from "./errors";
import { type TAuthzedHealthResult, checkAuthzedHealth } from "./health";

const INTERNAL_FAILURE_RESULT = {
  code: AUTHZED_ERROR_CODES.INTERNAL,
  latencyMs: 0,
  retryable: false,
  status: "unhealthy",
} as const satisfies TAuthzedHealthResult;

type TAuthzedHealthCliDependencies = Readonly<{
  checkHealth: () => Promise<TAuthzedHealthResult>;
  closeClient: () => void;
  writeOutput: (output: string) => void;
}>;

const defaultDependencies: TAuthzedHealthCliDependencies = {
  checkHealth: checkAuthzedHealth,
  closeClient: closeAuthzedClient,
  writeOutput: (output) => process.stdout.write(output),
};

export const runAuthzedHealthCli = async (
  dependencyOverrides: Partial<TAuthzedHealthCliDependencies> = {}
): Promise<number> => {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  let result: TAuthzedHealthResult;

  try {
    result = await dependencies.checkHealth();
  } catch {
    result = INTERNAL_FAILURE_RESULT;
  } finally {
    dependencies.closeClient();
  }

  dependencies.writeOutput(`${JSON.stringify(result)}\n`);
  return result.status === "healthy" ? 0 : 1;
};
