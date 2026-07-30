import "server-only";
import { env } from "@/lib/env";
import { reconcileApiKeyRelationships } from "./api-key";
import {
  type TAuthzedBackfillApply,
  type TAuthzedBackfillRequest,
  type TAuthzedBackfillResult,
  runAuthzedBackfill,
} from "./backfill";
import { closeAuthzedClient, getAuthzedClient } from "./client";
import { isAuthzedEnabled } from "./config";
import { AUTHZED_MAX_PRUNED_RESOURCES_PER_RUN } from "./constants";
import { AUTHZED_ERROR_CODES, AuthzedError, type TAuthzedErrorCode, mapAuthzedError } from "./errors";
import { reconcileOrganizationMemberships } from "./organization-membership";
import { reconcileTeamWorkspaceRelationships } from "./team-workspace";

/**
 * Command layer for relationship backfill and repair.
 *
 * Argument parsing lives here rather than in the script entry point, unlike the health and schema
 * commands: `apps/web/scripts/**` is excluded from coverage, and the flag matrix below — three
 * independent confirmations before anything destructive happens — is exactly the logic that must not
 * go untested.
 *
 * The exit-code contract matches `authzed:schema`: 0 clean, 2 drift remains, 1 failed or misused.
 */

export type TAuthzedBackfillCliCommand = Readonly<{
  afterOrganizationId?: string;
  expectedEndpoint?: string;
  maxPrune: number;
  mode: "apply" | "dry_run";
  organizationId?: string;
  prune: boolean;
}>;

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
  run: (request, apply) => runAuthzedBackfill(request, { apply, client: getAuthzedClient() }),
  writeOutput: (output) => process.stdout.write(output),
};

const CUID_PATTERN = /^[a-z0-9]{20,40}$/;
const POSITIVE_INTEGER_PATTERN = /^[1-9][0-9]{0,6}$/;

const countFlag = (args: ReadonlyArray<string>, name: string): number =>
  args.filter((arg) => arg.startsWith(`--${name}=`)).length;

const readFlag = (args: ReadonlyArray<string>, name: string): string | undefined => {
  const prefix = `--${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
};

/**
 * Parse argv into a command, or `undefined` if the invocation is not one this tool will perform.
 *
 * Deliberately strict and deliberately inconvenient where it matters:
 *
 * - a dry run is the default, so a mistyped invocation is inert;
 * - `--prune` needs `--apply`, `--confirm-prune`, an explicit scope, and `--expected-endpoint`, so
 *   removing relationships cannot happen as a side effect of any shorter command;
 * - `--expected-endpoint` must match the configured endpoint. The endpoint differs per environment by
 *   construction, which the AuthZed system key does not — it is documented as a stable namespace and
 *   defaults to the same value everywhere, so it could not tell staging from production. This is the
 *   guard against a stale `.env` aiming the destructive path at the wrong instance, which matters
 *   because these commands read `.env` only and ignore `.env.local`;
 * - `--max-prune` may lower the per-run cap, never raise it.
 */
export const parseAuthzedBackfillCommand = (
  args: ReadonlyArray<string>
): TAuthzedBackfillCliCommand | undefined => {
  const known = new Set(["--apply", "--confirm-prune", "--prune"]);
  const flagNames = ["after-organization-id", "expected-endpoint", "max-prune", "organization-id", "scope"];
  for (const arg of args) {
    if (known.has(arg)) {
      continue;
    }
    if (flagNames.some((name) => arg.startsWith(`--${name}=`))) {
      continue;
    }
    return undefined;
  }

  const mode = args.includes("--apply") ? "apply" : "dry_run";
  const prune = args.includes("--prune");
  const confirmed = args.includes("--confirm-prune");
  // A repeated flag is an error rather than a silent first-wins: on a command that removes
  // relationships, an operator who typed a value twice deserves to be told which one would have
  // applied instead of finding out afterwards.
  if (flagNames.some((name) => countFlag(args, name) > 1)) {
    return undefined;
  }

  const organizationId = readFlag(args, "organization-id");
  const afterOrganizationId = readFlag(args, "after-organization-id");
  const expectedEndpoint = readFlag(args, "expected-endpoint");
  const rawMaxPrune = readFlag(args, "max-prune");
  const scope = readFlag(args, "scope");

  // `all` is the only value; it exists so pruning every organization has to be spelled out.
  if (scope !== undefined && scope !== "all") {
    return undefined;
  }
  if (scope === "all" && organizationId !== undefined) {
    return undefined;
  }

  if (organizationId !== undefined && !CUID_PATTERN.test(organizationId)) {
    return undefined;
  }
  if (afterOrganizationId !== undefined && !CUID_PATTERN.test(afterOrganizationId)) {
    return undefined;
  }
  // Resuming is meaningless when a single organization is named.
  if (organizationId !== undefined && afterOrganizationId !== undefined) {
    return undefined;
  }

  let maxPrune = AUTHZED_MAX_PRUNED_RESOURCES_PER_RUN;
  if (rawMaxPrune !== undefined) {
    if (!POSITIVE_INTEGER_PATTERN.test(rawMaxPrune)) {
      return undefined;
    }
    const requested = Number(rawMaxPrune);
    if (requested > AUTHZED_MAX_PRUNED_RESOURCES_PER_RUN) {
      return undefined;
    }
    maxPrune = requested;
  }

  if (prune) {
    if (mode !== "apply" || !confirmed || !expectedEndpoint) {
      return undefined;
    }
    // "Prune everything" must be typed, never defaulted into.
    if (organizationId === undefined && scope !== "all") {
      return undefined;
    }
  }

  if (confirmed && !prune) {
    return undefined;
  }

  return { afterOrganizationId, expectedEndpoint, maxPrune, mode, organizationId, prune };
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
      // The operator named an instance other than the configured one. Refuse rather than guess.
      result = invalidRequest();
      exitCode = 1;
    } else {
      result = await dependencies.run(
        {
          maxPrune: command.maxPrune,
          mode: command.mode,
          prune: command.prune,
          scope: command.organizationId
            ? { kind: "organization", organizationId: command.organizationId }
            : { afterOrganizationId: command.afterOrganizationId, kind: "all" },
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
