import "server-only";
import type { TAuthzedBackfillSource } from "../lib/authzed/backfill";
import type { TAuthzedOrganizationSource } from "../lib/authzed/backfill-source";
import { INVALID_CONFIGURATION_RESULT, INVALID_REQUEST_RESULT } from "./authzed-schema-results";

/**
 * Drives the real backfill orchestrator against a real SpiceDB, without a database.
 *
 * The compose smoke harness has no Formbricks PostgreSQL — `DATABASE_URL` points at a fake host and
 * Prisma never connects — so both the source reads and the reconcilers are stubbed. What runs for real
 * is the half that can only be trusted once it has met the engine: paging past the read bound, pinning
 * one revision across pages, mapping raw relationships back to the source records they imply, and
 * deciding whether pruning is allowed.
 *
 * The reconcilers are recorded rather than executed because they read PostgreSQL themselves. Their
 * deletion behaviour against a real SpiceDB is already covered by the relationship-projection
 * assertions elsewhere in this harness; what is new here is *which targets* the orchestrator hands
 * over, and under which flags.
 *
 * Refuses to run outside a test environment, mirroring `authzed-relationships-smoke.ts`. The real
 * operator command carries no such guard — that would defeat its purpose — and relies instead on its
 * confirmation flags, the endpoint check, and the prune cap.
 *
 * Commands:
 *   seed <count>       write `count` team parent relationships through the facade
 *   observe            drain every team relationship, reporting count and whether a revision was pinned
 *   report             dry run: detect orphans, hand over nothing
 *   prune              apply + prune: hand the orphans to the reconcilers
 *   prune-capped       apply + prune with a cap of 1, which must hand over nothing
 *   prune-page-capped  apply + prune with a cap above one page but below the total, which must also
 *                      hand over nothing — the case a per-page cap check would have part-pruned
 *   cleanup            remove the seeded relationships
 */

const COMMANDS = [
  "seed",
  "observe",
  "report",
  "prune",
  "prune-capped",
  "prune-page-capped",
  "cleanup",
] as const;
type TCommand = (typeof COMMANDS)[number];

const isCommand = (value: string | undefined): value is TCommand =>
  value !== undefined && (COMMANDS as readonly string[]).includes(value);

/** Fixture identifiers, sharing the `application-*` prefix the rest of the harness uses. */
const ORGANIZATION_ID = "application-backfill-smoke-org";
const teamId = (index: number): string => `application-backfill-smoke-team-${index}`;

const writeResult = (result: object): void => {
  process.stdout.write(`${JSON.stringify(result)}\n`);
};

// Annotated rather than cast: adding a field to the source types must break this at compile time, not
// at runtime inside the CI smoke job.
const emptySource: TAuthzedOrganizationSource = {
  apiKeyIds: [],
  apiKeyWorkspaceGrants: [],
  invalidApiKeyWorkspaceGrants: [],
  invalidWorkspaceTeamGrants: [],
  memberships: [],
  teamIds: [],
  teamMemberships: [],
  workspaceIds: [],
  workspaceTeamGrants: [],
};

const run = async (): Promise<void> => {
  const command = process.argv[2];
  if (!isCommand(command)) {
    writeResult(INVALID_REQUEST_RESULT);
    process.exitCode = 1;
    return;
  }

  if (process.env.NODE_ENV !== "test") {
    writeResult({ code: "authzed_backfill_smoke_refused", retryable: false, status: "failed" });
    process.exitCode = 1;
    return;
  }

  let closeClient: (() => void) | undefined;

  try {
    const { closeAuthzedClient, configureAuthzedClientForBulkWork, getAuthzedClient } =
      await import("../lib/authzed/client");
    closeClient = closeAuthzedClient;
    // The same widening the CLI performs. Without it this exercises the sweep against the request-path
    // deadline, so the one test that runs the sweep for real would not be running what operators run.
    configureAuthzedClientForBulkWork();
    const client = getAuthzedClient();

    if (command === "seed") {
      const count = Number(process.argv[3] ?? "0");
      if (!Number.isSafeInteger(count) || count < 1 || count > 900) {
        writeResult(INVALID_REQUEST_RESULT);
        process.exitCode = 1;
        return;
      }

      await client.writeRelationships(
        Array.from({ length: count }, (_unused, index) => ({
          operation: "touch" as const,
          relationship: {
            relation: "organization",
            resource: { objectId: teamId(index), objectType: "team" },
            subject: { objectId: ORGANIZATION_ID, objectType: "organization" },
          },
        }))
      );

      writeResult({ seeded: count, status: "seeded" });
      process.exitCode = 0;
      return;
    }

    if (command === "cleanup") {
      await client.deleteRelationships({
        resourceType: "team",
        subject: { objectId: ORGANIZATION_ID, objectType: "organization" },
      });
      writeResult({ status: "cleaned" });
      process.exitCode = 0;
      return;
    }

    const { readAllRelationships } = await import("../lib/authzed/relationship-reads");

    if (command === "observe") {
      const observation = await readAllRelationships(client, { resourceType: "team" });
      writeResult({
        relationshipCount: observation.relationships.length,
        snapshotPinned: observation.snapshot !== null,
        status: "observed",
      });
      process.exitCode = 0;
      return;
    }

    const { runAuthzedBackfill } = await import("../lib/authzed/backfill");

    // Every relationship the harness seeded is absent from PostgreSQL by construction, so reporting
    // each observed record as missing is both honest and the fullest exercise of the orphan path.
    const source: TAuthzedBackfillSource = {
      findMismatchedParentEdges: async () => [],
      findMissingSourceRefs: async (refs) => refs,
      organizationExists: async () => true,
      readOrganizationIdPage: async () => [],
      readOrganizationSource: async () => emptySource,
      readWorkspaceSource: async () => ({
        apiKeyWorkspaceGrants: [],
        organizationId: null,
        workspaceExists: false,
        workspaceTeamGrants: [],
      }),
    };

    const handedOver: unknown[] = [];
    const record = async (targets: unknown) => {
      handedOver.push(targets);
      return { passes: 1, status: "projected" } as const;
    };

    const applying = command !== "report";
    // 280 sits above one read page (250) and below the seeded total, so a cap enforced per page would
    // prune the first page and stop. Only a cap decided against the whole sweep hands over nothing.
    const maxPruneFor: Record<string, number> = { "prune-capped": 1, "prune-page-capped": 280 };
    const result = await runAuthzedBackfill(
      {
        maxPrune: maxPruneFor[command] ?? 500,
        mode: applying ? "apply" : "dry_run",
        prune: applying,
        scope: { kind: "all" },
      },
      {
        apply: {
          reconcileApiKeys: record,
          reconcileMemberships: record,
          reconcileTeamWorkspace: record,
        },
        client,
        source,
      }
    );

    writeResult({
      handedOverCount: handedOver.length,
      orphaned: result.counters.orphaned,
      pruned: result.counters.pruned,
      skipped: result.counters.skipped,
      status: result.status,
      truncated: result.truncated,
    });
    process.exitCode = result.status === "failed" ? 1 : 0;
  } catch {
    writeResult(INVALID_CONFIGURATION_RESULT);
    process.exitCode = 1;
  } finally {
    closeClient?.();
  }
};

void run();
