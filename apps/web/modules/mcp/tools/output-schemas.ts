import { z } from "zod";
import { INVALID_PARAM_CODES } from "@/app/api/v3/lib/response";

/**
 * The error half of every MCP tool result, as `responseToMcpToolResult` builds it from a v3 problem
 * document.
 *
 * Every field mirrors that function rather than the RFC 9457 document it reads: `type` and
 * `instance` are dropped on the way through, and `status` carries the HTTP code the operation
 * answered. Kept in step by `errors.test.ts`.
 */
export const ZMcpToolError = z
  .object({
    status: z.number().int(),
    title: z.string(),
    detail: z.string(),
    requestId: z.string(),
    code: z.string().optional(),
    invalid_params: z
      .array(
        z
          .object({
            name: z.string(),
            reason: z.string(),
            code: z.enum(INVALID_PARAM_CODES).optional(),
            identifier: z.string().optional(),
            referenceType: z.string().optional(),
            missingId: z.string().optional(),
            firstUsedAt: z.string().optional(),
            conflictsWith: z.string().optional(),
          })
          .loose()
      )
      .optional(),
  })
  .strict();

/**
 * The `meta` a v3 collection answers with, as the list tools pass it through.
 *
 * These four keys are the envelope `successListResponse` emits for a keyset-paged collection, and
 * they are the four the contract marks required (`api_v3_responses.yml`, the list `meta` block).
 * Naming anything else here is worse than naming nothing: `outputSchema` is what a client types
 * itself against off `tools/list`, so a key this schema invents is a key that client reads as
 * `undefined` forever. An earlier version declared `hasMore` and `total`, neither of which exists
 * anywhere in `app/api/v3` — the same drift as the `precision`/`relation` defect, minus the loud
 * failure, because `nullish` plus `loose` let the SDK validate the wrong shape clean.
 *
 * Required rather than optional for that reason: a missing key now fails validation where it used to
 * pass silently. `totalCount` and `totalCountRelation` are present-but-`null` unless the caller asks
 * for `includeTotalCount`, which is why they are nullable rather than absent.
 */
export const ZMcpListMeta = z
  .object({
    limit: z.number().int(),
    nextCursor: z.string().nullable(),
    totalCount: z.number().int().nullable(),
    totalCountRelation: z.enum(["eq", "gte"]).nullable(),
  })
  .loose();

/**
 * Wrap a resource schema into the envelope a tool actually returns.
 *
 * **One object root, with every branch optional, is deliberate.** A tool answers either the success
 * payload or the error one, which reads like a union — but a union converts to a root-level `anyOf`,
 * and the SDK then has to wrap the result for a 2025-era client to keep the wire shape legal. An
 * object root is identity on both eras, so the same structured payload reaches every client.
 *
 * The cost is that the schema cannot say "exactly one of these". That is a real loss of precision
 * and the reason `error` is fully described rather than left as a bare object: a client reading the
 * schema can still tell the two apart by which key is present, and can type both.
 *
 * `requestId` sits at the root on success and inside `error` on failure — again mirroring
 * `responseToMcpToolResult` rather than tidying it, because the schema's job is to describe what the
 * tool sends, not what would have been neater to send.
 */
export const mcpToolOutput = <TData extends z.ZodType>(data: TData) =>
  z
    .object({
      data: data.optional(),
      meta: ZMcpListMeta.optional(),
      requestId: z.string().optional(),
      error: ZMcpToolError.optional(),
    })
    .strict();

/** For an operation whose success body carries no `data` — a 204, or a bare acknowledgement. */
export const ZMcpAcknowledgement = mcpToolOutput(z.unknown());
