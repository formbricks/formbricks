import { z } from "zod";
import {
  type TKeysetCursor,
  computeFilterFingerprint,
  decodeKeysetCursor,
} from "@/app/api/v3/lib/keyset-cursor";

export const RETENTION_RUNS_CURSOR_KIND = "retention-runs";
export const RETENTION_RUNS_SORT = "-startedAt";
export const RETENTION_RUNS_DEFAULT_LIMIT = 25;
export const RETENTION_RUNS_MAX_LIMIT = 100;

const ZBooleanQueryParam = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

/**
 * The filters a History cursor is bound to. A cursor issued for one organisation, or with empty runs
 * hidden, is rejected on a request with a different one, rather than continuing a walk through a
 * different set of rows.
 */
export const retentionRunsFingerprint = ({
  organizationId,
  includeEmpty,
}: {
  organizationId: string;
  includeEmpty: boolean;
}): string => computeFilterFingerprint({ organizationId, includeEmpty });

/**
 * `GET /api/internal/retention-runs` query. The cursor is decoded here, in the parse layer, so a
 * malformed or mismatched cursor is a 400 on `cursor` like any other invalid parameter.
 */
export const ZRetentionRunsListQuery = z
  .object({
    organizationId: z.cuid2(),
    limit: z.coerce.number().int().min(1).max(RETENTION_RUNS_MAX_LIMIT).default(RETENTION_RUNS_DEFAULT_LIMIT),
    cursor: z.string().trim().min(1).optional(),
    includeEmpty: ZBooleanQueryParam,
  })
  .strict()
  .transform((query, ctx) => {
    const fingerprint = retentionRunsFingerprint(query);
    let cursor: TKeysetCursor | null = null;

    if (query.cursor) {
      try {
        cursor = decodeKeysetCursor(query.cursor, {
          kind: RETENTION_RUNS_CURSOR_KIND,
          sortBy: RETENTION_RUNS_SORT,
          fp: fingerprint,
        });
      } catch (error) {
        ctx.addIssue({
          code: "custom",
          path: ["cursor"],
          message: error instanceof Error ? error.message : "The cursor is invalid.",
        });
        return z.NEVER;
      }
    }

    return { ...query, cursor, fingerprint };
  });

export type TRetentionRunsListQuery = z.infer<typeof ZRetentionRunsListQuery>;

/** `GET /api/internal/retention-runs/export` query. `from` is inclusive and `to` exclusive. */
export const ZRetentionRunsExportQuery = z
  .object({
    organizationId: z.cuid2(),
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
  })
  .strict()
  .refine((query) => !query.from || !query.to || new Date(query.from) < new Date(query.to), {
    path: ["to"],
    message: "to must be later than from",
  })
  .transform((query) => ({
    organizationId: query.organizationId,
    from: query.from ? new Date(query.from) : null,
    to: query.to ? new Date(query.to) : null,
  }));

export type TRetentionRunsExportQuery = z.infer<typeof ZRetentionRunsExportQuery>;
