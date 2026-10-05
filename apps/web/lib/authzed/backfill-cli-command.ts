import "server-only";
import { AUTHZED_MAX_PRUNED_RESOURCES_PER_RUN } from "./constants";

export type TAuthzedBackfillCliCommand = Readonly<{
  afterOrganizationId?: string;
  afterSurveyId?: string;
  /** `--clear-ready`: clear the survey readiness marker and run nothing else (ENG-3282). */
  clearReady: boolean;
  expectedEndpoint?: string;
  /** `--mark-ready`: set the survey readiness marker once two consecutive audits come back clean. */
  markReady: boolean;
  maxPrune: number;
  mode: "apply" | "dry_run";
  organizationId?: string;
  prune: boolean;
  /** `--scope=survey`: walk surveys rather than organizations. */
  surveyScope: boolean;
  workspaceId?: string;
}>;

const CUID_PATTERN = /^[a-z0-9]{20,40}$/;
const POSITIVE_INTEGER_PATTERN = /^[1-9]\d{0,6}$/;

const countFlag = (args: ReadonlyArray<string>, name: string): number =>
  args.filter((arg) => arg.startsWith(`--${name}=`)).length;

const readFlag = (args: ReadonlyArray<string>, name: string): string | undefined => {
  const prefix = `--${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
};

const KNOWN_BOOLEAN_FLAGS = new Set([
  "--apply",
  "--clear-ready",
  "--confirm-prune",
  "--mark-ready",
  "--prune",
]);

const VALUE_FLAG_NAMES = [
  "after-organization-id",
  "after-survey-id",
  "expected-endpoint",
  "max-prune",
  "organization-id",
  "scope",
  "workspace-id",
] as const;

type TFlagSelection = Readonly<{
  afterOrganizationId?: string;
  afterSurveyId?: string;
  expectedEndpoint?: string;
  organizationId?: string;
  scope?: string;
  workspaceId?: string;
}>;

const hasOnlyKnownArguments = (args: ReadonlyArray<string>): boolean =>
  args.every(
    (arg) => KNOWN_BOOLEAN_FLAGS.has(arg) || VALUE_FLAG_NAMES.some((name) => arg.startsWith(`--${name}=`))
  );

const hasRepeatedFlag = (args: ReadonlyArray<string>): boolean =>
  VALUE_FLAG_NAMES.some((name) => countFlag(args, name) > 1);

const isScopeNamedUnambiguously = ({ organizationId, scope, workspaceId }: TFlagSelection): boolean => {
  if (scope !== undefined && scope !== "all" && scope !== "survey") {
    return false;
  }

  return (
    [scope !== undefined, organizationId !== undefined, workspaceId !== undefined].filter(Boolean).length <= 1
  );
};

const areIdentifiersValid = ({
  afterOrganizationId,
  afterSurveyId,
  organizationId,
  scope,
  workspaceId,
}: TFlagSelection): boolean => {
  const ids = [organizationId, afterOrganizationId, afterSurveyId, workspaceId].filter(
    (id): id is string => id !== undefined
  );
  if (!ids.every((id) => CUID_PATTERN.test(id))) {
    return false;
  }

  // Each resume cursor belongs to exactly one walk: organizations for the full scope, surveys for the
  // survey scope.
  if (afterSurveyId !== undefined && scope !== "survey") {
    return false;
  }
  if (afterOrganizationId !== undefined && scope === "survey") {
    return false;
  }

  return afterOrganizationId === undefined || (organizationId === undefined && workspaceId === undefined);
};

/**
 * The readiness flags are survey-scope only, and mutually exclusive. `--clear-ready` is a rollback
 * lever: it runs nothing but the clear, so it takes no mode, prune, or cursor flags either.
 */
const isReadinessRequestPermitted = ({
  args,
  clearReady,
  markReady,
  selection,
}: Readonly<{
  args: ReadonlyArray<string>;
  clearReady: boolean;
  markReady: boolean;
  selection: TFlagSelection;
}>): boolean => {
  if (!markReady && !clearReady) return true;
  if (markReady && clearReady) return false;
  if (selection.scope !== "survey") return false;
  if (clearReady) {
    return args.every(
      (arg) => arg === "--clear-ready" || arg === "--scope=survey" || arg.startsWith("--expected-endpoint=")
    );
  }
  // Marking ready is a statement about the whole survey graph, so a resumed partial walk cannot make it.
  return selection.afterSurveyId === undefined;
};

const resolveMaxPrune = (raw: string | undefined): number | undefined => {
  if (raw === undefined) {
    return AUTHZED_MAX_PRUNED_RESOURCES_PER_RUN;
  }
  if (!POSITIVE_INTEGER_PATTERN.test(raw)) {
    return undefined;
  }

  const requested = Number(raw);
  return requested > AUTHZED_MAX_PRUNED_RESOURCES_PER_RUN ? undefined : requested;
};

const isPruneRequestPermitted = ({
  confirmed,
  mode,
  prune,
  selection,
}: Readonly<{
  confirmed: boolean;
  mode: "apply" | "dry_run";
  prune: boolean;
  selection: TFlagSelection;
}>): boolean => {
  if (!prune) {
    return !confirmed;
  }
  if (mode !== "apply" || !confirmed || !selection.expectedEndpoint) {
    return false;
  }

  return (
    selection.organizationId !== undefined ||
    selection.workspaceId !== undefined ||
    selection.scope === "all" ||
    selection.scope === "survey"
  );
};

/**
 * Parse argv without loading AuthZed configuration, the SDK client, or PostgreSQL.
 *
 * A dry run is the default. Pruning requires apply, confirmation, an explicit scope, and the expected endpoint;
 * repeated or ambiguous flags are rejected rather than silently resolved.
 */
export const parseAuthzedBackfillCommand = (
  args: ReadonlyArray<string>
): TAuthzedBackfillCliCommand | undefined => {
  if (!hasOnlyKnownArguments(args) || hasRepeatedFlag(args)) {
    return undefined;
  }

  const mode = args.includes("--apply") ? "apply" : "dry_run";
  const prune = args.includes("--prune");
  const confirmed = args.includes("--confirm-prune");
  const markReady = args.includes("--mark-ready");
  const clearReady = args.includes("--clear-ready");

  const selection: TFlagSelection = {
    afterOrganizationId: readFlag(args, "after-organization-id"),
    afterSurveyId: readFlag(args, "after-survey-id"),
    expectedEndpoint: readFlag(args, "expected-endpoint"),
    organizationId: readFlag(args, "organization-id"),
    scope: readFlag(args, "scope"),
    workspaceId: readFlag(args, "workspace-id"),
  };

  if (
    !isScopeNamedUnambiguously(selection) ||
    !areIdentifiersValid(selection) ||
    !isReadinessRequestPermitted({ args, clearReady, markReady, selection })
  ) {
    return undefined;
  }

  const maxPrune = resolveMaxPrune(readFlag(args, "max-prune"));
  if (maxPrune === undefined || !isPruneRequestPermitted({ confirmed, mode, prune, selection })) {
    return undefined;
  }

  return {
    afterOrganizationId: selection.afterOrganizationId,
    afterSurveyId: selection.afterSurveyId,
    clearReady,
    expectedEndpoint: selection.expectedEndpoint,
    markReady,
    maxPrune,
    mode,
    organizationId: selection.organizationId,
    prune,
    surveyScope: selection.scope === "survey",
    workspaceId: selection.workspaceId,
  };
};
