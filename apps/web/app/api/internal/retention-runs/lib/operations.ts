import "server-only";
import { buildKeysetPage } from "@/app/api/v3/lib/keyset-cursor";
import { successListResponse } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { requireRetentionOrgAccess } from "@/modules/ee/data-retention/lib/api-access";
import { listRetentionRunKeysetPage } from "@/modules/ee/data-retention/lib/runs-service";
import { RETENTION_RUNS_CURSOR_KIND, RETENTION_RUNS_SORT, type TRetentionRunsListQuery } from "../schemas";
import { serializeRetentionRun } from "../serializers";

/**
 * History, newest first. Owners and managers only: run items name the people who were notified or
 * deactivated, so History is not member-readable even though the policies are (ENG-3695).
 */
export async function listRetentionRunsOperation({
  authentication,
  query,
  requestId,
  instance,
}: {
  authentication: TV3Authentication;
  query: TRetentionRunsListQuery;
  requestId: string;
  instance?: string;
}): Promise<Response> {
  const access = await requireRetentionOrgAccess({
    authentication,
    organizationId: query.organizationId,
    action: "organization.manage",
    requestId,
    instance,
  });
  if (access instanceof Response) return access;

  const rows = await listRetentionRunKeysetPage({
    organizationId: access.organizationId,
    includeEmpty: query.includeEmpty,
    limit: query.limit,
    cursor: query.cursor,
  });

  const { page, nextCursor } = buildKeysetPage({
    rows,
    limit: query.limit,
    kind: RETENTION_RUNS_CURSOR_KIND,
    sortBy: RETENTION_RUNS_SORT,
    fp: query.fingerprint,
    sortValue: (run) => run.startedAt,
  });

  return successListResponse(
    page.map(serializeRetentionRun),
    { limit: query.limit, nextCursor },
    { requestId }
  );
}
