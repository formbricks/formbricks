import "server-only";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import type { TCubeQueryActor } from "@/modules/ee/analysis/api/lib/cube-config";
import { runChartQuery } from "@/modules/ee/analysis/lib/run-chart-query";
import { getMemberAttributeValuesByKey } from "@/modules/ee/member-attributes/lib/service";
import {
  type TCubeViewerAccessClaim,
  type TResolvedViewerAccess,
  type TViewerAccessSummary,
  UNRESTRICTED_VIEWER_ACCESS,
  VIEWER_ACCESS_MAX_CONDITIONS,
  buildViewerAccessClaim,
  hasUnrestrictedViewerDataset,
  isViewerAccessUnmatched,
  summarizeViewerAccess,
} from "./viewer-access-claim";

/**
 * A Dashboard Viewer's access to Feedback Datasets' records (ADR-0061): each dataset's conditions with
 * the viewer's Member attribute values for them. Read for every dashboard-bound read of a viewer, never
 * cached, so a changed condition or attribute applies on the next read.
 */
export const resolveViewerAccessForDatasets = async (
  organizationId: string,
  userId: string,
  datasetIds: readonly string[]
): Promise<Map<string, TResolvedViewerAccess | null>> => {
  const ids = [...new Set(datasetIds)];
  const resolved = new Map<string, TResolvedViewerAccess | null>(ids.map((id) => [id, null]));
  if (ids.length === 0) return resolved;

  const datasets = await prisma.feedbackDirectory.findMany({
    where: { id: { in: ids }, organizationId },
    select: {
      id: true,
      viewerAccessJoin: true,
      viewerAccessConditions: {
        orderBy: [{ order: "asc" }, { id: "asc" }],
        take: VIEWER_ACCESS_MAX_CONDITIONS,
        select: { field: true, attributeKeyId: true, attributeKey: { select: { label: true } } },
      },
    },
  });
  const restricted = datasets.filter(({ viewerAccessConditions }) => viewerAccessConditions.length > 0);
  if (restricted.length === 0) return resolved;

  const needsEmail = restricted.some(({ viewerAccessConditions }) =>
    viewerAccessConditions.some(({ attributeKeyId }) => attributeKeyId === null)
  );
  const [valuesByKey, user] = await Promise.all([
    getMemberAttributeValuesByKey(organizationId, userId),
    needsEmail
      ? prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
      : Promise.resolve(null),
  ]);

  const emailValues = user?.email ? [user.email] : [];
  for (const dataset of restricted) {
    resolved.set(dataset.id, {
      join: dataset.viewerAccessJoin,
      conditions: dataset.viewerAccessConditions.map(({ field, attributeKeyId, attributeKey }) => ({
        field,
        attributeKeyId,
        attributeLabel: attributeKey?.label ?? "Email",
        values: attributeKeyId === null ? emailValues : (valuesByKey.get(attributeKeyId) ?? []),
      })),
    });
  }
  return resolved;
};

/**
 * Whose Dashboard Viewer access a dashboard-bound read is under: the user a read was admitted for as a
 * Dashboard Viewer (the caller, or the member chosen in View as). `null` for everyone else, who reads
 * every record.
 */
export type TViewerAccessReader = { userId: string; organizationId: string } | null;

/** The claim a read of `datasetId` carries for `reader`, with the embedded keys it needs; `null` for none. */
export const getViewerAccessClaimForDataset = async (
  reader: TViewerAccessReader,
  datasetId: string
): Promise<{ claim: TCubeViewerAccessClaim; embeddedKeys: string[] } | null> => {
  if (!reader) return null;
  const resolved = await resolveViewerAccessForDatasets(reader.organizationId, reader.userId, [datasetId]);
  return buildViewerAccessClaim(resolved.get(datasetId) ?? null);
};

/** Where a summary's record probe runs: the workspace the dashboard reads from, as the caller. */
export type TViewerAccessProbeScope = { workspaceId: string; actor: TCubeQueryActor };

/** Probes run at once for one dashboard read, and how long a probe's answer is reused. */
export const VIEWER_ACCESS_PROBE_CONCURRENCY = 4;
const PROBE_CACHE_TTL_MS = 60_000;
const PROBE_CACHE_MAX_ENTRIES = 10_000;

/**
 * Answers of recent probes, per viewer, dataset and claim, on this server. A dashboard read with many
 * restricted datasets probes each at most once a minute for a viewer, so repeated reads (every open,
 * every refresh) don't repeat the count queries. A changed attribute or row rule changes the claim, and
 * with it the key, so it is never answered from an older claim.
 */
const probeCache = new Map<string, { matched: boolean; expiresAt: number }>();

const readProbeCache = (key: string): boolean | undefined => {
  const entry = probeCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt > Date.now()) return entry.matched;
  probeCache.delete(key);
  return undefined;
};

const writeProbeCache = (key: string, matched: boolean) => {
  if (probeCache.size >= PROBE_CACHE_MAX_ENTRIES) probeCache.clear();
  probeCache.set(key, { matched, expiresAt: Date.now() + PROBE_CACHE_TTL_MS });
};

/** Clears the probe answers; for tests. */
export const resetViewerAccessProbeCache = () => probeCache.clear();

/**
 * Whether `reader` sees at least one record of `datasetId` under their access: one count query carrying
 * the same claim every chart read carries, so "matches nothing" means exactly what the charts would show.
 */
const hasMatchingRecord = async (
  reader: NonNullable<TViewerAccessReader>,
  datasetId: string,
  resolved: TResolvedViewerAccess,
  scope: TViewerAccessProbeScope
): Promise<boolean> => {
  const viewerAccess = buildViewerAccessClaim(resolved);
  if (!viewerAccess) return true;
  const { rows } = await runChartQuery({
    query: { measures: ["FeedbackRecords.count"] },
    datasetId,
    workspaceId: scope.workspaceId,
    organizationId: reader.organizationId,
    actor: scope.actor,
    source: "v3.dashboards.chartData",
    viewerAccess,
  });
  return rows.some((row) => Number(row["FeedbackRecords.count"] ?? 0) > 0);
};

/**
 * Whether the probe finds a record, or `true` when it cannot run (Cube unreachable or refusing). The probe
 * only picks the message a viewer sees, and every chart read carries the claim itself, so a failed probe
 * leaves the dashboard readable and each chart shows its own error, instead of failing the whole read.
 */
const probeMatchingRecord = async (
  reader: NonNullable<TViewerAccessReader>,
  datasetId: string,
  resolved: TResolvedViewerAccess,
  scope: TViewerAccessProbeScope
): Promise<boolean> => {
  const key = JSON.stringify([reader.userId, datasetId, buildViewerAccessClaim(resolved)]);
  const cached = readProbeCache(key);
  if (cached !== undefined) return cached;
  try {
    const matched = await hasMatchingRecord(reader, datasetId, resolved, scope);
    writeProbeCache(key, matched);
    return matched;
  } catch (error) {
    logger.warn(
      { error, datasetId, organizationId: reader.organizationId },
      "Dashboard Viewer access probe failed; treating the dataset as matched"
    );
    return true;
  }
};

/**
 * The summary of `reader`'s access to the datasets a dashboard's visible pages read. With a probe scope,
 * a viewer whose values exist but match no record in any restricted dataset (a misspelt "Swedn") is
 * `unmatched` too, so they see "Your access hasn't been set up" rather than a page of empty charts.
 */
export const getViewerAccessSummary = async (
  reader: TViewerAccessReader,
  datasetIds: readonly string[],
  probe?: TViewerAccessProbeScope
): Promise<TViewerAccessSummary> => {
  if (!reader || datasetIds.length === 0) return UNRESTRICTED_VIEWER_ACCESS;
  const resolved = await resolveViewerAccessForDatasets(reader.organizationId, reader.userId, datasetIds);
  const summary = summarizeViewerAccess([...resolved.values()]);
  // A dataset without conditions keeps its charts visible, so the dashboard is never "unmatched" as a whole.
  if (summary.status !== "restricted" || !probe || hasUnrestrictedViewerDataset([...resolved.values()])) {
    return summary;
  }

  // A dataset whose conditions the viewer holds no value for matches nothing: no probe needed.
  const restricted = [...resolved.entries()].filter(
    (entry): entry is [string, TResolvedViewerAccess] =>
      entry[1] !== null && !isViewerAccessUnmatched(entry[1])
  );
  // Every restricted dataset is probed until one matches, so "unmatched" is only ever said when none
  // does: a few at a time (`VIEWER_ACCESS_PROBE_CONCURRENCY`), no new probe once one matched, and each
  // answer reused for a minute, so a dashboard with many datasets doesn't repeat them on every read.
  let matched = false;
  let next = 0;
  const worker = async () => {
    while (!matched && next < restricted.length) {
      const [datasetId, access] = restricted[next++];
      if (await probeMatchingRecord(reader, datasetId, access, probe)) matched = true;
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(VIEWER_ACCESS_PROBE_CONCURRENCY, restricted.length) }, worker)
  );
  return matched ? summary : { ...summary, status: "unmatched" };
};
