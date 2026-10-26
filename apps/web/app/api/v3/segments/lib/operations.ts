import "server-only";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { assertV3ContactsEnabled } from "@/app/api/v3/lib/contacts-entitlement";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { problemBadRequest, successListResponse } from "@/app/api/v3/lib/response";
import { buildSortCursorPage } from "@/app/api/v3/lib/sort-cursor";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { resolveV3VisibleSurveyWhere } from "@/app/api/v3/surveys/visibility-context";
import { selectSegment, transformPrismaSegment } from "@/modules/ee/contacts/segments/lib/segments";
import { serializeV3Segment } from "../serializers";
import { SEGMENTS_CURSOR_KIND, parseV3SegmentsListQuery } from "./parse-v3-segments-list-query";
import {
  buildV3SegmentsCursorWhere,
  buildV3SegmentsOrderBy,
  buildV3SegmentsWhere,
  segmentSortValue,
} from "./segments-where";

type TListV3SegmentsParams = {
  searchParams: URLSearchParams;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
};

export async function listV3Segments({
  searchParams,
  authentication,
  requestId,
  instance,
}: TListV3SegmentsParams): Promise<Response> {
  const log = logger.withContext({ requestId });

  try {
    const query = parseV3SegmentsListQuery(searchParams);
    if (!query.ok) {
      log.warn({ statusCode: 400, invalidParams: query.invalid_params }, "Validation failed");
      return problemBadRequest(requestId, "Invalid query parameters", {
        invalid_params: query.invalid_params,
        instance,
      });
    }

    const authResult = await requireV3WorkspaceAccess(
      authentication,
      query.workspaceId,
      "read",
      requestId,
      instance
    );
    if (authResult instanceof Response) return authResult;

    const denied = await assertV3ContactsEnabled(authResult.organizationId, requestId, instance);
    if (denied) return denied;

    // ENG-3282: a segment's survey references are read through the caller's survey-visibility clause,
    // exactly as `getSegments` does for the page — otherwise the list would ship restricted survey
    // names and ids. Fails closed (no survey visible) when the caller cannot be resolved.
    const visibleSurveyWhere = await resolveV3VisibleSurveyWhere(authentication, authResult.organizationId);

    const where = buildV3SegmentsWhere(authResult.workspaceId, query.search);
    const pageWhere = query.cursor
      ? { AND: [where, buildV3SegmentsCursorWhere(query.cursor, query.sortBy)] }
      : where;

    const [rows, totalCount] = await Promise.all([
      prisma.segment.findMany({
        where: pageWhere,
        orderBy: buildV3SegmentsOrderBy(query.sortBy),
        take: query.limit + 1,
        select: { ...selectSegment, surveys: { ...selectSegment.surveys, where: visibleSurveyWhere } },
      }),
      query.includeTotalCount ? prisma.segment.count({ where }) : Promise.resolve(null),
    ]);

    const { page, nextCursor } = buildSortCursorPage({
      rows,
      limit: query.limit,
      kind: SEGMENTS_CURSOR_KIND,
      sortBy: query.sortBy,
      fp: query.fingerprint,
      sortValue: (row) => segmentSortValue(row, query.sortBy),
    });

    return successListResponse(
      page.map((row) => serializeV3Segment(transformPrismaSegment(row))),
      { limit: query.limit, nextCursor, totalCount },
      { requestId, cache: "private, no-store" }
    );
  } catch (err) {
    return mapV3ThrownError(err, { log, requestId, instance, operation: "segments.list" });
  }
}
