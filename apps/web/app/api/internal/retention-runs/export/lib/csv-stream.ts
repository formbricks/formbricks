import "server-only";
import { logger } from "@formbricks/logger";
import { toCsvLine } from "@/lib/utils/file-conversion";
import type { TRetentionExportRow } from "@/modules/ee/data-retention/lib/runs-service";

export const RETENTION_EXPORT_COLUMNS = [
  "run_id",
  "policy",
  "run_started_at",
  "run_finished_at",
  "action",
  "target_type",
  "target_id",
  "target_name",
  "count",
  "recipient",
  "skip_reason",
] as const;

/** Rows encoded per `pull`, so a large export isn't one chunk per row. */
const ROWS_PER_CHUNK = 500;

export const toRetentionExportCells = ({ run, item }: TRetentionExportRow) => [
  run.id,
  run.entity,
  run.startedAt.toISOString(),
  run.finishedAt ? run.finishedAt.toISOString() : null,
  item?.action ?? null,
  item?.targetType ?? null,
  item?.targetId ?? null,
  item?.targetName ?? null,
  item ? item.count : null,
  item?.recipient ?? null,
  item?.skipReason ?? null,
];

export type TRetentionExportOutcome = {
  status: "success" | "failure";
  /** Data rows written, not counting the header. */
  rows: number;
  /** Why a failed export stopped. */
  reason?: "aborted" | "error";
};

/**
 * Streams the History CSV from a row iterator. Pull-based: the next batch is read from the database only
 * when the client has taken the previous one, so a slow download never buffers the whole history.
 *
 * `onFinish` runs exactly once, when the last row is written, the read fails, or the client goes away
 * (`cancel`, or the request signal aborting). That is where the export's audit event belongs: a 200 is
 * already on the wire when the stream opens, so the wrapper can't know how it ended.
 */
export const createRetentionExportStream = ({
  rows,
  signal,
  onFinish,
}: {
  rows: AsyncGenerator<TRetentionExportRow>;
  signal: AbortSignal;
  onFinish: (outcome: TRetentionExportOutcome) => Promise<void>;
}): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  let written = 0;
  let headerSent = false;
  let finished = false;

  const finish = async (outcome: Omit<TRetentionExportOutcome, "rows">) => {
    if (finished) return;
    finished = true;
    try {
      await onFinish({ ...outcome, rows: written });
    } catch (error) {
      logger.error({ err: error }, "Failed to record the retention export outcome");
    }
  };

  const stop = async (reason: "aborted" | "error") => {
    try {
      await rows.return(undefined);
    } catch {
      // Already finished or failed; nothing left to release.
    }
    await finish({ status: "failure", reason });
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (finished) return;

      if (!headerSent) {
        headerSent = true;
        controller.enqueue(encoder.encode(toCsvLine(RETENTION_EXPORT_COLUMNS)));
        return;
      }

      if (signal.aborted) {
        controller.close();
        await stop("aborted");
        return;
      }

      try {
        let chunk = "";
        for (let index = 0; index < ROWS_PER_CHUNK; index++) {
          const next = await rows.next();
          if (next.done) {
            if (chunk) controller.enqueue(encoder.encode(chunk));
            controller.close();
            await finish({ status: "success" });
            return;
          }
          chunk += toCsvLine(toRetentionExportCells(next.value));
          written++;
        }
        controller.enqueue(encoder.encode(chunk));
      } catch (error) {
        logger.error({ err: error }, "Retention export failed while streaming");
        // Erroring the body makes the download fail visibly, rather than leaving a file that looks
        // complete but isn't.
        controller.error(error);
        await stop("error");
      }
    },
    async cancel() {
      await stop("aborted");
    },
  });
};
