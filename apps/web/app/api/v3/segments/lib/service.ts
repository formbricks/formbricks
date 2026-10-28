import "server-only";
import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";
import { MAX_SEGMENT_SURVEYS } from "@formbricks/types/segment";
import { buildKeysetPage } from "@/app/api/v3/lib/keyset-cursor";
import type { TKeysetCursor } from "@/app/api/v3/lib/keyset-cursor";
import { andVisibleSurveys } from "@/lib/survey/visibility/predicate";

export const SEGMENT_LIST_SORT = "-createdAt";
export const SEGMENT_LIST_KIND = "segments.list";

const segmentListSelect = {
  id: true,
  workspaceId: true,
  title: true,
  description: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SegmentSelect;

/**
 * One page of the workspace's reusable segments. The private ones are not listed: each is the targeting
 * of a single survey (titled with that survey's id) and is read and written through the survey.
 */
export async function listSegmentRows(params: {
  workspaceId: string;
  limit: number;
  cursor: Pick<TKeysetCursor, "value" | "id"> | null;
  fingerprint: string;
}) {
  const { workspaceId, limit, cursor, fingerprint } = params;
  const base = { workspaceId, isPrivate: false };
  const createdAt = cursor ? new Date(cursor.value) : null;

  const rows = await prisma.segment.findMany({
    where:
      cursor && createdAt
        ? { AND: [base, { OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: cursor.id } }] }] }
        : base,
    select: segmentListSelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  return buildKeysetPage({
    rows,
    limit,
    kind: SEGMENT_LIST_KIND,
    sortBy: SEGMENT_LIST_SORT,
    fp: fingerprint,
    sortValue: (row) => row.createdAt,
  });
}

/**
 * The surveys using a segment, through the caller's survey-visibility clause: a restricted survey's name
 * and id must not reach someone who cannot read it (ENG-3282), exactly as on the segments page.
 */
export const getSegmentSurveyRefs = (
  segmentId: string,
  workspaceId: string,
  visibleSurveyWhere: Prisma.SurveyWhereInput
) =>
  prisma.survey.findMany({
    where: { segmentId, workspaceId, ...andVisibleSurveys(visibleSurveyWhere) },
    select: { id: true, name: true, status: true },
    orderBy: { id: "asc" },
    take: MAX_SEGMENT_SURVEYS,
  });

/** Titles are unique per workspace, and a clash would otherwise surface as an opaque database error. */
export const findSegmentIdByTitle = async (workspaceId: string, title: string): Promise<string | null> => {
  const segment = await prisma.segment.findUnique({
    where: { workspaceId_title: { workspaceId, title } },
    select: { id: true },
  });
  return segment?.id ?? null;
};
