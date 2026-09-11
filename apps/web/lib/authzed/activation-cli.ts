import "server-only";
import type { TAuthzedActivationCliCommand } from "./activation-cli-command";
import {
  abortAuthzedActivation,
  activatePreparedAuthzedAuthorization,
  bootstrapDevelopmentAuthzedActivation,
  bootstrapFreshAuthzedActivation,
  finalizePreparedAuthzedAuthorization,
  prepareAuthzedActivation,
  rollbackAuthzedAuthorization,
} from "./activation-protocol";
import { getAuthzedActivationStatus } from "./activation-repository";
import { checkAuthzedRuntimeActivation, waitForAuthzedRuntimeActivation } from "./activation-runtime";
import { mapAuthzedError } from "./errors";

type TActivationCliDependencies = Readonly<{
  abort: typeof abortAuthzedActivation;
  activate: typeof activatePreparedAuthzedAuthorization;
  bootstrap: typeof bootstrapFreshAuthzedActivation;
  bootstrapDevelopment: typeof bootstrapDevelopmentAuthzedActivation;
  finalize: typeof finalizePreparedAuthzedAuthorization;
  prepare: typeof prepareAuthzedActivation;
  rollback: typeof rollbackAuthzedAuthorization;
  runtimeCheck: typeof checkAuthzedRuntimeActivation;
  runtimeWait: typeof waitForAuthzedRuntimeActivation;
  status: typeof getAuthzedActivationStatus;
  writeOutput: (output: string) => void;
}>;

const defaultDependencies: TActivationCliDependencies = {
  abort: abortAuthzedActivation,
  activate: activatePreparedAuthzedAuthorization,
  bootstrap: bootstrapFreshAuthzedActivation,
  bootstrapDevelopment: bootstrapDevelopmentAuthzedActivation,
  finalize: finalizePreparedAuthzedAuthorization,
  prepare: prepareAuthzedActivation,
  rollback: rollbackAuthzedAuthorization,
  runtimeCheck: checkAuthzedRuntimeActivation,
  runtimeWait: waitForAuthzedRuntimeActivation,
  status: getAuthzedActivationStatus,
  writeOutput: (output) => process.stdout.write(output),
};

const serializeStatus = async (dependencies: TActivationCliDependencies): Promise<object> => {
  const status = await dependencies.status();
  return {
    authority: status.authority,
    fenceActive: status.fenceActive,
    generation: status.generation.toString(),
    status: "ready",
    transition: status.transition,
  };
};

const execute = async (
  command: TAuthzedActivationCliCommand,
  dependencies: TActivationCliDependencies
): Promise<object> => {
  switch (command.action) {
    case "status":
      return serializeStatus(dependencies);
    case "runtime_check":
      return dependencies.runtimeCheck();
    case "runtime_wait":
      return dependencies.runtimeWait({ intervalMs: command.intervalMs, timeoutMs: command.timeoutMs });
    case "prepare": {
      const receipt = await dependencies.prepare(command);
      return { receipt, status: "prepared" };
    }
    case "activate":
      await dependencies.activate(command.receiptId);
      return { status: "activated" };
    case "finalize":
      await dependencies.finalize(command.receiptId);
      return { status: "finalized" };
    case "abort":
      await dependencies.abort(command.receiptId);
      return { status: "aborted" };
    case "rollback_begin":
      await dependencies.rollback("begin", command.receiptId);
      return { status: "rollback_started" };
    case "rollback_complete":
      await dependencies.rollback("complete", command.receiptId);
      return { status: "rolled_back" };
    case "bootstrap":
      await dependencies.bootstrap();
      return { status: "activated" };
    case "bootstrap_development":
      await dependencies.bootstrapDevelopment();
      return { status: "activated" };
  }
};

export const runAuthzedActivationCli = async (
  command: TAuthzedActivationCliCommand,
  dependencyOverrides: Partial<TActivationCliDependencies> = {}
): Promise<number> => {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  let result: object;
  let exitCode = 0;
  try {
    result = await execute(command, dependencies);
  } catch (error) {
    const mapped = mapAuthzedError(error, "activation_cli", 1);
    result = { code: mapped.code, retryable: mapped.retryable, status: "failed" };
    exitCode = 1;
  }
  dependencies.writeOutput(`${JSON.stringify(result)}\n`);
  return exitCode;
};
