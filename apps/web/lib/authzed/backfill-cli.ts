import "server-only";
import { env } from "@/lib/env";
import {
  type TAuthzedBackfillApply,
  type TAuthzedBackfillRequest,
  type TAuthzedBackfillResult,
  runAuthzedBackfill,
} from "./backfill";
import { createAuthzedBackfillApply, createAuthzedBackfillNoopApply } from "./backfill-apply";
import type { TAuthzedBackfillCliCommand } from "./backfill-cli-command";
import { closeAuthzedClient, configureAuthzedClientForBulkWork, getAuthzedClient } from "./client";
import { isAuthzedEnabled } from "./config";
import { AUTHZED_ERROR_CODES, AuthzedError, type TAuthzedErrorCode, mapAuthzedError } from "./errors";
import { clearProjectionScopeReady, setProjectionScopeReady } from "./scope-readiness";

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

/** What `--mark-ready` / `--clear-ready` report next to (or instead of) the run itself. */
type TAuthzedReadinessOutcome = Readonly<{ readiness: "not-ready" | "ready"; readinessScope: "survey" }>;

type TAuthzedBackfillCliDependencies = Readonly<{
  clearSurveyReadiness: () => Promise<void>;
  closeClient: () => void;
  isEnabled: () => boolean;
  markSurveyReady: () => Promise<void>;
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
const defaultDependencies: TAuthzedBackfillCliDependencies = {
  clearSurveyReadiness: () => clearProjectionScopeReady("survey"),
  closeClient: closeAuthzedClient,
  isEnabled: isAuthzedEnabled,
  markSurveyReady: () => setProjectionScopeReady("survey", "authzed:backfill --mark-ready"),
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

/** The four scopes are mutually exclusive, enforced during parsing. */
const resolveScope = (command: TAuthzedBackfillCliCommand): TAuthzedBackfillRequest["scope"] => {
  if (command.surveyScope) {
    return { afterSurveyId: command.afterSurveyId, kind: "survey" };
  }
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

/**
 * `--mark-ready`: after the requested run, audit twice more and set the marker only if both come back
 * clean. Two passes rather than one so a relationship the first pass saw mid-write cannot slip
 * through, and dry runs so the marker is never set on the strength of the run that just wrote.
 */
const auditAndMarkReady = async (
  dependencies: TAuthzedBackfillCliDependencies,
  request: TAuthzedBackfillRequest,
  first: TAuthzedBackfillResult
): Promise<TAuthzedBackfillResult & TAuthzedReadinessOutcome> => {
  let latest = first;
  if (first.status !== "failed") {
    for (let pass = 0; pass < 2; pass++) {
      latest = await dependencies.run(
        { ...request, mode: "dry_run", prune: false },
        createAuthzedBackfillNoopApply()
      );
      if (latest.status !== "reconciled") break;
    }
  }

  if (first.status === "failed" || latest.status !== "reconciled") {
    return { ...latest, readiness: "not-ready", readinessScope: "survey" };
  }

  await dependencies.markSurveyReady();
  return { ...latest, readiness: "ready", readinessScope: "survey" };
};

export const runAuthzedBackfillCli = async (
  command: TAuthzedBackfillCliCommand,
  dependencyOverrides: Partial<TAuthzedBackfillCliDependencies> = {}
): Promise<number> => {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  let result: TAuthzedBackfillResult | TAuthzedBackfillCliFailure | TAuthzedReadinessOutcome =
    invalidRequest();
  let exitCode = 1;

  // The rollback lever runs first and alone: it must work while AuthZed itself is what is broken.
  if (command.clearReady) {
    try {
      await dependencies.clearSurveyReadiness();
      result = { readiness: "not-ready", readinessScope: "survey" };
      exitCode = 0;
    } catch (error) {
      result = toFailureResult(error);
    }
    dependencies.writeOutput(`${JSON.stringify(result)}\n`);
    return exitCode;
  }

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
      const request: TAuthzedBackfillRequest = {
        maxPrune: command.maxPrune,
        mode: command.mode,
        prune: command.prune,
        scope: resolveScope(command),
      };
      const runResult = await dependencies.run(
        request,
        command.mode === "apply" ? createAuthzedBackfillApply() : createAuthzedBackfillNoopApply()
      );
      const finalResult = command.markReady
        ? await auditAndMarkReady(dependencies, request, runResult)
        : runResult;
      result = finalResult;
      exitCode = toExitCode(finalResult.status);
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
