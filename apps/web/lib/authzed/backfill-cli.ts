import "server-only";
import { env } from "@/lib/env";
import { reconcileApiKeyRelationships } from "./api-key";
import {
  type TAuthzedBackfillApply,
  type TAuthzedBackfillRequest,
  type TAuthzedBackfillResult,
  runAuthzedBackfill,
} from "./backfill";
import type { TAuthzedBackfillCliCommand } from "./backfill-cli-command";
import { closeAuthzedClient, configureAuthzedClientForBulkWork, getAuthzedClient } from "./client";
import { isAuthzedEnabled } from "./config";
import { AUTHZED_ERROR_CODES, AuthzedError, type TAuthzedErrorCode, mapAuthzedError } from "./errors";
import { reconcileOrganizationMemberships } from "./organization-membership";
import { reconcileTeamWorkspaceRelationships } from "./team-workspace";

export { parseAuthzedBackfillCommand } from "./backfill-cli-command";
export type { TAuthzedBackfillCliCommand } from "./backfill-cli-command";

/**
 * Command layer for relationship backfill and repair.
 *
 * Argument parsing lives in a side-effect-free sibling module so invalid commands can be rejected before
 * environment validation, SDK construction, or database access.
 *
 * The exit-code contract matches `authzed:schema`: 0 clean, 2 drift remains, 1 failed or misused.
 */

type TAuthzedBackfillCliFailure = Readonly<{
  code: TAuthzedErrorCode;
  retryable: boolean;
  status: "failed";
}>;

type TAuthzedBackfillCliDependencies = Readonly<{
  closeClient: () => void;
  isEnabled: () => boolean;
  resolveEndpoint: () => string | undefined;
  run: (request: TAuthzedBackfillRequest, apply: TAuthzedBackfillApply) => Promise<TAuthzedBackfillResult>;
  writeOutput: (output: string) => void;
}>;

/**
 * Real reconcilers. Selected once, in `runAuthzedBackfillCli`, and only for an applying run.
 *
 * The orchestrator can reach a mutation only through this object, so a dry run supplying
 * `createInertApply()` cannot write regardless of any flag it is passed.
 */
const createWritableApply = (): TAuthzedBackfillApply => ({
  reconcileApiKeys: reconcileApiKeyRelationships,
  reconcileMemberships: reconcileOrganizationMemberships,
  reconcileTeamWorkspace: reconcileTeamWorkspaceRelationships,
});

const INERT_RESULT = { passes: 0, status: "projected" } as const;

/** No-op reconcilers for a dry run. */
const createInertApply = (): TAuthzedBackfillApply => ({
  reconcileApiKeys: async () => INERT_RESULT,
  reconcileMemberships: async () => INERT_RESULT,
  reconcileTeamWorkspace: async () => INERT_RESULT,
});

const defaultDependencies: TAuthzedBackfillCliDependencies = {
  closeClient: closeAuthzedClient,
  isEnabled: isAuthzedEnabled,
  resolveEndpoint: () => env.AUTHZED_ENDPOINT,
  // Widened before the first client is built, so the reconcilers this hands to the orchestrator — which
  // reach the channel through `getAuthzedClient()` themselves — write under the same bulk deadline the
  // sweep reads under.
  run: (request, apply) => {
    configureAuthzedClientForBulkWork();

    return runAuthzedBackfill(request, { apply, client: getAuthzedClient() });
  },
  writeOutput: (output) => process.stdout.write(output),
};

const toFailureResult = (error: unknown): TAuthzedBackfillCliFailure => {
  const authzedError = error instanceof AuthzedError ? error : mapAuthzedError(error, "backfill_cli", 1);

  return { code: authzedError.code, retryable: authzedError.retryable, status: "failed" };
};

const invalidRequest = (): TAuthzedBackfillCliFailure => ({
  code: AUTHZED_ERROR_CODES.INVALID_REQUEST,
  retryable: false,
  status: "failed",
});

/** The three scopes are mutually exclusive, enforced during parsing. */
const resolveScope = (command: TAuthzedBackfillCliCommand): TAuthzedBackfillRequest["scope"] => {
  if (command.workspaceId) {
    return { kind: "workspace", workspaceId: command.workspaceId };
  }
  if (command.organizationId) {
    return { kind: "organization", organizationId: command.organizationId };
  }
  return { afterOrganizationId: command.afterOrganizationId, kind: "all" };
};

const toExitCode = (status: TAuthzedBackfillResult["status"]): number => {
  switch (status) {
    case "reconciled":
      return 0;
    case "drifted":
      return 2;
    case "failed":
      return 1;
  }
};

export const runAuthzedBackfillCli = async (
  command: TAuthzedBackfillCliCommand,
  dependencyOverrides: Partial<TAuthzedBackfillCliDependencies> = {}
): Promise<number> => {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  let result: TAuthzedBackfillResult | TAuthzedBackfillCliFailure = invalidRequest();
  let exitCode = 1;

  try {
    // Checked up front. Left to the per-unit result, a disabled instance would report every
    // organization as reconciled, because that is what "not failed" looks like from the outside.
    if (!dependencies.isEnabled()) {
      throw new AuthzedError({
        attempts: 0,
        code: AUTHZED_ERROR_CODES.DISABLED,
        operation: "backfill_cli",
        retryable: false,
      });
    }

    if (
      command.expectedEndpoint !== undefined &&
      command.expectedEndpoint !== dependencies.resolveEndpoint()
    ) {
      // The operator named an instance other than the configured one. Refuse rather than guess — and
      // report a distinct code, because "you aimed this at the wrong SpiceDB" and "you mistyped a flag"
      // want very different reactions.
      // `exitCode` is already 1 from its initializer, which is what this branch wants.
      result = {
        code: AUTHZED_ERROR_CODES.FAILED_PRECONDITION,
        retryable: false,
        status: "failed",
      };
    } else {
      result = await dependencies.run(
        {
          maxPrune: command.maxPrune,
          mode: command.mode,
          prune: command.prune,
          scope: resolveScope(command),
        },
        command.mode === "apply" ? createWritableApply() : createInertApply()
      );
      exitCode = toExitCode(result.status);
    }
  } catch (error) {
    result = toFailureResult(error);
    exitCode = 1;
  } finally {
    try {
      dependencies.closeClient();
    } catch {
      // Cleanup failures must not replace the backfill's result or exit code.
    }
  }

  dependencies.writeOutput(`${JSON.stringify(result)}\n`);
  return exitCode;
};
