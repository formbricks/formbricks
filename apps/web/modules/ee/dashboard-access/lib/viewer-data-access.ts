import "server-only";
import { prisma } from "@formbricks/database";
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
 * A Dashboard Viewer's access to Feedback Datasets' records (ADR-0060): each dataset's conditions with
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

  for (const dataset of restricted) {
    resolved.set(dataset.id, {
      join: dataset.viewerAccessJoin,
      conditions: dataset.viewerAccessConditions.map(({ field, attributeKeyId, attributeKey }) => ({
        field,
        attributeKeyId,
        attributeLabel: attributeKey?.label ?? "Email",
        values: attributeKeyId === null ? (user?.email ? [user.email] : []) : (valuesByKey.get(attributeKeyId) ?? []),
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

/** The summary of `reader`'s access to the datasets a dashboard's visible pages read. */
export const getViewerAccessSummary = async (
  reader: TViewerAccessReader,
  datasetIds: readonly string[]
): Promise<TViewerAccessSummary> => {
  if (!reader || datasetIds.length === 0) return UNRESTRICTED_VIEWER_ACCESS;
  const resolved = await resolveViewerAccessForDatasets(reader.organizationId, reader.userId, datasetIds);
  return summarizeViewerAccess([...resolved.values()]);
};
