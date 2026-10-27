import { z } from "zod";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ConcurrencyLimiter } from "@/app/lib/api/concurrency-limiter";
import { ZExportRequest } from "@/lib/analysis-export/export-request";
import { handleExportRequest } from "./lib/handle-export";

// @formbricks/database and the archive writers are Node-only.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `POST /api/surveys/{surveyId}/export` — the Export modal's download (ENG-6792).
 *
 * Internal and session-only, like the attachments ZIP route it is modelled on: no OpenAPI entry, no
 * compatibility promise, the only caller is this app's export manager. It is a POST because a selection
 * of rows travels as a list of ids, which a query string cannot carry. `?dryRun=true` returns the counts
 * for the modal's "Include X responses" line instead of a file.
 *
 * The export runs in the request. The CSV and the zip stream; Excel is built whole. A client that goes
 * away aborts `req.signal`, which stops the reading, so leaving the page cancels the export.
 */

const paramsSchema = z.object({ surveyId: z.cuid2() });

const querySchema = z.object({
  dryRun: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

/** Per process, and per signed-in user: an export holds a database connection and a stream for minutes. */
const exportConcurrency = new ConcurrencyLimiter(6, { maxPerKey: 3 });

export const POST = withV3ApiWrapper({
  auth: "session",
  action: "exported",
  targetType: "file",
  concurrency: { limiter: exportConcurrency, retryAfterSeconds: 15 },
  schemas: { params: paramsSchema, query: querySchema, body: ZExportRequest },
  handler: ({ req, parsedInput, authentication, requestId, instance, auditLog }) =>
    handleExportRequest({
      surveyId: parsedInput.params.surveyId,
      body: parsedInput.body,
      dryRun: parsedInput.query.dryRun,
      authentication,
      auditLog,
      signal: req.signal,
      requestId,
      instance,
    }),
});
