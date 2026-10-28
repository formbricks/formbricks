import { z } from "zod";
import { problemConflict } from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import type { TAuditTarget } from "@/modules/ee/audit-logs/types/audit-log";

/**
 * Pull/push documents (agent-first, ADR 0015). An agent pulls a survey, creative or workflow as one JSON
 * document, edits it locally, and pushes it back. The three kinds share this envelope and these rules:
 *
 * - A document is the resource's editable state. It carries no lifecycle fields, so a push never
 *   publishes, pauses or enables anything; that stays a separate, separately audited call.
 * - A push replaces the editable state. Omitted fields reset rather than merge.
 * - A push must name the `updatedAt` it was pulled at. A stale one is refused with a 409 that carries
 *   `currentUpdatedAt`, so a push never overwrites an edit it has not seen.
 * - A push that would remove data (questions with responses, a live creative's destination) is refused
 *   with a 409 naming what would go, unless `confirmDestructive` is set.
 * - `dryRun` runs every check and returns what would change without writing.
 */

export const V3_DOCUMENT_KINDS = ["survey", "creative", "workflow"] as const;
export const ZV3DocumentKind = z.enum(V3_DOCUMENT_KINDS);
export type TV3DocumentKind = z.infer<typeof ZV3DocumentKind>;

/** Bumped when a kind's document shape changes incompatibly. A push with another version is refused. */
export const V3_DOCUMENT_SCHEMA_VERSION = 1;

export const ZV3DocumentEnvelope = z.object({
  kind: ZV3DocumentKind,
  schemaVersion: z.literal(V3_DOCUMENT_SCHEMA_VERSION),
  id: z.string(),
  workspaceId: z.string(),
  updatedAt: z.string(),
  document: z.record(z.string(), z.unknown()),
});
export type TV3DocumentEnvelope = z.infer<typeof ZV3DocumentEnvelope>;

export const ZV3DocumentChange = z.object({
  path: z.string(),
  change: z.enum(["added", "removed", "changed"]),
});
export type TV3DocumentChange = z.infer<typeof ZV3DocumentChange>;

/** What a push answers: the document as stored afterwards (or as it would be, for a dry run). */
export const ZV3DocumentPushResult = z.object({
  envelope: ZV3DocumentEnvelope,
  dryRun: z.boolean(),
  changes: z.array(ZV3DocumentChange),
});
export type TV3DocumentPushResult = z.infer<typeof ZV3DocumentPushResult>;

/** The part of a push request that is the same for every kind; `document` is validated by the adapter. */
export const ZV3DocumentPushBody = z
  .object({
    schemaVersion: z.literal(V3_DOCUMENT_SCHEMA_VERSION),
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
    document: z.record(z.string(), z.unknown()),
    dryRun: z.boolean().optional(),
    confirmDestructive: z.boolean().optional(),
  })
  .strict();
export type TV3DocumentPushBody = z.infer<typeof ZV3DocumentPushBody>;

type TBaseParams = {
  authentication: TV3Authentication;
  requestId: string;
  instance?: string;
};

export type TV3DocumentPullParams = TBaseParams & { id: string };

export type TV3DocumentPushParams = TV3DocumentPullParams & {
  document: Record<string, unknown>;
  expectedUpdatedAt: string;
  dryRun: boolean;
  confirmDestructive: boolean;
  auditLog?: TV3AuditLog;
};

/**
 * One per kind. Both answer a `Response` for every outcome and never throw, like every v3 operation:
 * `pull` a `successResponse(TV3DocumentEnvelope)`, `push` a `successResponse(TV3DocumentPushResult)`.
 * The adapter owns authorization, tenancy, validation and the write, by reusing the resource's own
 * operations rather than reimplementing them.
 */
export type TV3DocumentAdapter = {
  kind: TV3DocumentKind;
  /** The audit target a push is recorded under. */
  targetType: TAuditTarget;
  pull: (params: TV3DocumentPullParams) => Promise<Response>;
  push: (params: TV3DocumentPushParams) => Promise<Response>;
};

export const buildDocumentEnvelope = (
  kind: TV3DocumentKind,
  resource: { id: string; workspaceId: string; updatedAt: string },
  document: Record<string, unknown>
): TV3DocumentEnvelope => ({
  kind,
  schemaVersion: V3_DOCUMENT_SCHEMA_VERSION,
  id: resource.id,
  workspaceId: resource.workspaceId,
  updatedAt: resource.updatedAt,
  document,
});

/** 409 for a push made against a resource that changed since it was pulled. Same shape as the surveys' own. */
export const problemStaleDocument = (
  requestId: string,
  expectedUpdatedAt: string,
  currentUpdatedAt: string,
  instance?: string
): Response =>
  problemConflict(
    requestId,
    "The resource changed since this document was pulled. Pull it again, reapply your edit, and push with the new updatedAt.",
    instance,
    { details: { expectedUpdatedAt, currentUpdatedAt } }
  );

export type TV3DestructiveChange = {
  /** What would be lost, e.g. `blocks_removed`, `elements_removed`, `destination_removed`. */
  type: string;
  ids?: string[];
  /** Responses recorded against what would be removed, when the adapter can count them. */
  responseCount?: number;
};

/** 409 for a push that would remove data and was not confirmed. A retry with `confirmDestructive` applies it. */
export const problemDestructiveChange = (
  requestId: string,
  changes: TV3DestructiveChange[],
  instance?: string
): Response =>
  problemConflict(
    requestId,
    "This push would remove data. Review `details.changes`, then repeat it with confirmDestructive: true if that is intended.",
    instance,
    { details: { reason: "destructive_change", changes } }
  );

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasStringIds = (items: unknown[]): items is Array<Record<string, unknown> & { id: string }> =>
  items.length > 0 && items.every((item) => isRecord(item) && typeof item.id === "string");

const sameJson = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);

/**
 * What differs between two documents, as paths an agent can read: top-level keys, and for an array of
 * `{ id }` objects (blocks, endings, workflow nodes) the ids inside it. Everything else that differs is
 * reported as the whole key changing. Deliberately shallow: it summarizes a push, the audit event carries
 * the full diff.
 */
export function diffDocuments(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): TV3DocumentChange[] {
  const changes: TV3DocumentChange[] = [];
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();

  for (const key of keys) {
    const previous = before[key];
    const next = after[key];

    if (previous === undefined && next !== undefined) {
      changes.push({ path: key, change: "added" });
    } else if (previous !== undefined && next === undefined) {
      changes.push({ path: key, change: "removed" });
    } else if (!sameJson(previous, next)) {
      if (Array.isArray(previous) && Array.isArray(next) && hasStringIds(previous) && hasStringIds(next)) {
        changes.push(...diffById(key, previous, next));
      } else {
        changes.push({ path: key, change: "changed" });
      }
    }
  }

  return changes;
}

function diffById(
  key: string,
  previous: Array<Record<string, unknown> & { id: string }>,
  next: Array<Record<string, unknown> & { id: string }>
): TV3DocumentChange[] {
  const before = new Map(previous.map((item) => [item.id, item]));
  const after = new Map(next.map((item) => [item.id, item]));
  const changes: TV3DocumentChange[] = [];

  for (const [id, item] of after) {
    const old = before.get(id);
    if (!old) changes.push({ path: `${key}[${id}]`, change: "added" });
    else if (!sameJson(old, item)) changes.push({ path: `${key}[${id}]`, change: "changed" });
  }
  for (const id of before.keys()) {
    if (!after.has(id)) changes.push({ path: `${key}[${id}]`, change: "removed" });
  }
  // Same members in a different order: the ids above all match, but the array still changed.
  if (changes.length === 0) changes.push({ path: key, change: "changed" });

  return changes;
}
