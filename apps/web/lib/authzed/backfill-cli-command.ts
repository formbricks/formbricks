import "server-only";
import { AUTHZED_MAX_PRUNED_RESOURCES_PER_RUN } from "./constants";

export type TAuthzedBackfillCliCommand = Readonly<{
  afterOrganizationId?: string;
  expectedEndpoint?: string;
  maxPrune: number;
  mode: "apply" | "dry_run";
  organizationId?: string;
  prune: boolean;
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

const KNOWN_BOOLEAN_FLAGS = new Set(["--apply", "--confirm-prune", "--prune"]);

const VALUE_FLAG_NAMES = [
  "after-organization-id",
  "expected-endpoint",
  "max-prune",
  "organization-id",
  "scope",
  "workspace-id",
] as const;

type TFlagSelection = Readonly<{
  afterOrganizationId?: string;
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
  if (scope !== undefined && scope !== "all") {
    return false;
  }

  return (
    [scope === "all", organizationId !== undefined, workspaceId !== undefined].filter(Boolean).length <= 1
  );
};

const areIdentifiersValid = ({
  afterOrganizationId,
  organizationId,
  workspaceId,
}: TFlagSelection): boolean => {
  const ids = [organizationId, afterOrganizationId, workspaceId].filter(
    (id): id is string => id !== undefined
  );
  if (!ids.every((id) => CUID_PATTERN.test(id))) {
    return false;
  }

  return afterOrganizationId === undefined || (organizationId === undefined && workspaceId === undefined);
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
    selection.organizationId !== undefined || selection.workspaceId !== undefined || selection.scope === "all"
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

  const selection: TFlagSelection = {
    afterOrganizationId: readFlag(args, "after-organization-id"),
    expectedEndpoint: readFlag(args, "expected-endpoint"),
    organizationId: readFlag(args, "organization-id"),
    scope: readFlag(args, "scope"),
    workspaceId: readFlag(args, "workspace-id"),
  };

  if (!isScopeNamedUnambiguously(selection) || !areIdentifiersValid(selection)) {
    return undefined;
  }

  const maxPrune = resolveMaxPrune(readFlag(args, "max-prune"));
  if (maxPrune === undefined || !isPruneRequestPermitted({ confirmed, mode, prune, selection })) {
    return undefined;
  }

  return {
    afterOrganizationId: selection.afterOrganizationId,
    expectedEndpoint: selection.expectedEndpoint,
    maxPrune,
    mode,
    organizationId: selection.organizationId,
    prune,
    workspaceId: selection.workspaceId,
  };
};
