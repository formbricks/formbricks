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
  try {
    return await hasMatchingRecord(reader, datasetId, resolved, scope);
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
  if (summary.status !== "restricted" || !probe) return summary;

  const restricted = [...resolved.entries()].filter(
    (entry): entry is [string, TResolvedViewerAccess] => entry[1] !== null
  );
  const matches = await Promise.all(
    restricted.map(([datasetId, access]) => probeMatchingRecord(reader, datasetId, access, probe))
  );
  return matches.some(Boolean) ? summary : { ...summary, status: "unmatched" };
};
