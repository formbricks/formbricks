import "server-only";
import { skipV3AuditLog } from "@/app/api/v3/lib/audit";
import { problemUnprocessableContent } from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { getClientIpFromHeaders } from "@/lib/utils/client-ip";
import { queueAuditEventWithoutRequest } from "@/modules/ee/audit-logs/lib/handler";
import { requireRetentionOrgAccess } from "@/modules/ee/data-retention/lib/api-access";
import {
  countRetentionExportRows,
  iterateRetentionExportRows,
} from "@/modules/ee/data-retention/lib/runs-service";
import type { TRetentionRunsExportQuery } from "../../schemas";
import { createRetentionExportStream } from "./csv-stream";

/**
 * The most rows one export may write. The date range stays open (ENG-3695, Javi's review): instead of a
 * fixed window, the rows in range are counted before the stream opens and an export past this is a 422
 * asking for a narrower range. A file is never cut short, because History is what goes to an audit.
 */
export const RETENTION_EXPORT_MAX_ROWS = 100_000;

const exportFileName = (organizationId: string, now: Date) =>
  `retention-history-${organizationId}-${now.toISOString().slice(0, 10)}.csv`;

/**
 * The History CSV: every run and item in the range, empty runs included. Owners and managers only,
 * because it lists the people who were notified, deactivated or skipped.
 *
 * Every check happens before the stream opens; once it has, the status is a 200 whatever follows. The
 * export's own audit event is written when the stream finishes, fails or is cancelled, so the wrapper's
 * event (which would record success the moment the response object is returned) is suppressed then.
 * Failures before the stream (403, 422, 429) are still audited by the wrapper.
 */
export async function exportRetentionRunsOperation({
  req,
  authentication,
  query,
  requestId,
  instance,
  auditLog,
}: {
  req: Request;
  authentication: TV3Authentication;
  query: TRetentionRunsExportQuery;
  requestId: string;
  instance?: string;
  auditLog?: TV3AuditLog;
}): Promise<Response> {
  if (auditLog) {
    auditLog.organizationId = query.organizationId;
    auditLog.targetId = query.organizationId;
  }

  const access = await requireRetentionOrgAccess({
    authentication,
    organizationId: query.organizationId,
    action: "organization.manage",
    requestId,
    instance,
  });
  if (access instanceof Response) return access;

  const range = { organizationId: access.organizationId, from: query.from, to: query.to };
  const rowCount = await countRetentionExportRows(range, RETENTION_EXPORT_MAX_ROWS);
  if (rowCount > RETENTION_EXPORT_MAX_ROWS) {
    return problemUnprocessableContent(
      requestId,
      `This export would have more than ${RETENTION_EXPORT_MAX_ROWS.toLocaleString("en-US")} rows. Choose a narrower date range with from and to.`,
      { instance, code: "retention_export_too_large" }
    );
  }

  // Captured now: the stream outlives the request scope, and reading headers after it has ended fails.
  const ipAddress = await getClientIpFromHeaders();
  const auditBase = auditLog ? { ...auditLog } : null;
  skipV3AuditLog(auditLog);

  const stream = createRetentionExportStream({
    rows: iterateRetentionExportRows(range),
    signal: req.signal,
    onFinish: async (outcome) => {
      if (!auditBase) return;
      await queueAuditEventWithoutRequest({
        ...auditBase,
        status: outcome.status,
        eventId: requestId,
        ipAddress,
        newObject: {
          rows: outcome.rows,
          from: query.from?.toISOString() ?? null,
          to: query.to?.toISOString() ?? null,
          ...(outcome.reason ? { stopped: outcome.reason } : {}),
        },
      });
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName(access.organizationId, new Date())}"`,
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
      "X-Request-Id": requestId,
    },
  });
}
