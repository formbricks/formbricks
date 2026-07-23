import "server-only";
import { closeAuthzedClient } from "./client";
import { AuthzedError, type TAuthzedErrorCode, mapAuthzedError } from "./errors";
import {
  type TAuthzedSchemaApplyResult,
  type TAuthzedSchemaCheckResult,
  applyCanonicalAuthzedSchema,
  checkCanonicalAuthzedSchema,
} from "./schema";

export type TAuthzedSchemaCliCommand =
  | Readonly<{ action: "check" }>
  | Readonly<{ action: "apply"; expectedCurrentDigest?: string }>;

type TAuthzedSchemaCliFailure = Readonly<{
  code: TAuthzedErrorCode;
  retryable: boolean;
  status: "failed";
}>;

type TAuthzedSchemaCliDependencies = Readonly<{
  applySchema: (expectedCurrentDigest?: string) => Promise<TAuthzedSchemaApplyResult>;
  checkSchema: () => Promise<TAuthzedSchemaCheckResult>;
  closeClient: () => void;
  writeOutput: (output: string) => void;
}>;

const defaultDependencies: TAuthzedSchemaCliDependencies = {
  applySchema: applyCanonicalAuthzedSchema,
  checkSchema: checkCanonicalAuthzedSchema,
  closeClient: closeAuthzedClient,
  writeOutput: (output) => process.stdout.write(output),
};

const toFailureResult = (error: unknown): TAuthzedSchemaCliFailure => {
  const authzedError = error instanceof AuthzedError ? error : mapAuthzedError(error, "schema_cli", 1);

  return {
    code: authzedError.code,
    retryable: authzedError.retryable,
    status: "failed",
  };
};

export const runAuthzedSchemaCli = async (
  command: TAuthzedSchemaCliCommand,
  dependencyOverrides: Partial<TAuthzedSchemaCliDependencies> = {}
): Promise<number> => {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  let result: TAuthzedSchemaApplyResult | TAuthzedSchemaCheckResult | TAuthzedSchemaCliFailure;
  let exitCode: number;

  try {
    if (command.action === "apply") {
      result = await dependencies.applySchema(command.expectedCurrentDigest);
      exitCode = 0;
    } else {
      result = await dependencies.checkSchema();
      exitCode = result.status === "matched" ? 0 : 2;
    }
  } catch (error) {
    result = toFailureResult(error);
    exitCode = 1;
  } finally {
    dependencies.closeClient();
  }

  dependencies.writeOutput(`${JSON.stringify(result)}\n`);
  return exitCode;
};
