import { z } from "zod";

/**
 * The response id is a path parameter, so it is validated here rather than trusted: an unparseable id
 * must answer 400 before any query runs, not 500 from Prisma (ENG-483 is that bug on the v1 route).
 */
export const ZV3ResponseIdParams = z
  .object({
    responseId: z.cuid2(),
  })
  .strict();

export type TV3ResponseIdParams = z.infer<typeof ZV3ResponseIdParams>;

/**
 * `POST /api/v3/responses/batch-delete`.
 *
 * The cap and the uniqueness rule are the contract's, and both are enforced here rather than left to
 * the service: an oversized batch must answer 400 before it reaches a `deleteMany`, and duplicates
 * would make `deleted` unreconcilable against `ids.length` for no benefit to the caller.
 */
export const ZV3BatchDeleteResponsesQuery = z
  .object({
    workspaceId: z.cuid2(),
  })
  .strict();

export type TV3BatchDeleteResponsesQuery = z.infer<typeof ZV3BatchDeleteResponsesQuery>;

export const ZV3BatchDeleteResponsesBody = z
  .object({
    ids: z
      .array(z.cuid2())
      .min(1)
      .max(100)
      .refine((ids) => new Set(ids).size === ids.length, {
        message: "Response ids must be unique",
      }),
  })
  .strict();

export type TV3BatchDeleteResponsesBody = z.infer<typeof ZV3BatchDeleteResponsesBody>;

/**
 * The stored answer shapes, as `ResponseDataMap` publishes them.
 *
 * Four, not "any JSON": a scalar for most element types, a string array for the multi-selects and
 * the positional composites, and a label-keyed record for a matrix. Widening this to `z.unknown()`
 * would accept shapes no element can store and push the failure into the serializer, which reports
 * them as `valueShapeMismatch` on a row the caller could have been stopped from writing.
 */
const ZV3ResponseDataValue = z.union([
  z.string(),
  z.number(),
  z.array(z.string()),
  z.record(z.string(), z.string()),
]);

/** Embedded Data accepts scalars only, plus `null` to clear a field. No arrays, no objects. */
const ZV3EmbeddedDataValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);

/**
 * Submission context a caller may legitimately supply.
 *
 * `.strict()` is the contract's `additionalProperties: false`, and it is what rejects the twelve
 * browser-runtime keys the SDK captures (`pagePath`, the `utm*` family, the screen and viewport
 * dimensions, `timezone`, `locale`). The contract calls that a gap rather than a decision and defers
 * it to this ticket; it stays narrow here deliberately, because widening later is additive and
 * narrowing later would break callers who had come to rely on it.
 *
 * `country`, `userAgent` and `ipAddress` are a different case and stay out permanently: the routes
 * derive them from the request, so a caller-supplied value would be fiction.
 */
export const ZV3ResponseMetaInput = z
  .object({
    source: z.string().max(512).optional(),
    url: z.string().max(2048).optional(),
    action: z.string().max(512).optional(),
  })
  .strict();

/**
 * Per-element timing, in milliseconds.
 *
 * Values are not bounded here on purpose — the contract clamps rather than rejects, because noisy
 * client telemetry should never cost a caller their response. The clamp lives in the service.
 *
 * `z.number()` already rejects `NaN` and both infinities in Zod 4, so the clamp only ever sees a
 * real number; `.finite()` is deprecated and would add nothing.
 */
const ZV3ResponseTtcInput = z.record(z.string(), z.number());

const createFields = {
  surveyId: z.cuid2(),
  finished: z.boolean(),
  data: z.record(z.string(), ZV3ResponseDataValue),
  embeddedData: z.record(z.string(), ZV3EmbeddedDataValue).optional(),
  ttc: ZV3ResponseTtcInput.optional(),
  meta: ZV3ResponseMetaInput.optional(),
  tags: z
    .array(z.cuid2())
    .refine((ids) => new Set(ids).size === ids.length, { message: "Tag ids must be unique" })
    .optional(),
  endingId: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  contactId: z.cuid2().optional(),
  displayId: z.cuid2().optional(),
  /**
   * Bounded and non-empty, unlike the free-form string the obvious version of this would be.
   *
   * `min(1)` is load-bearing rather than tidiness: the uniqueness pre-check is gated on the value
   * being truthy, so an empty string would skip it and still be written — and the *second* such
   * create would reach the unique index instead of the 422. `max(255)` keeps an oversize value from
   * overflowing the `(surveyId, singleUseId)` btree entry, which raises a Postgres 54000 rather than
   * a P2002 and so answers 500. A generated id is a cuid2, or an encrypted one at roughly 100
   * characters, so this is far above anything legitimate.
   */
  singleUseId: z.string().min(1).max(255).optional(),
};

/**
 * `POST /api/v3/responses`.
 *
 * Three required fields and nothing implied: `surveyId`, `finished` and `data`. Everything the
 * caller may not set is absent from the shape rather than stripped afterwards, so `.strict()` turns
 * an attempt into a 400 naming the key instead of a silent drop — which is the difference between a
 * caller learning that `createdAt` is server-owned and one believing they backdated a response.
 */
export const ZV3CreateResponseBody = z.object(createFields).strict();
export type TV3CreateResponseBody = z.infer<typeof ZV3CreateResponseBody>;

/**
 * `PATCH /api/v3/responses/{responseId}`.
 *
 * Six patchable fields, and at least one of them — an empty body is a 400 rather than a no-op 200,
 * because a caller sending nothing has a bug and a 200 would hide it.
 *
 * `ttc` and `meta` are create-only and so absent here: both describe the original submission event,
 * which a later correction does not change. `contactId`, `displayId` and `singleUseId` are
 * create-only too — re-linking a response to a different contact is the ENG-1923 shape, and
 * `singleUseId` is a security control rather than a label.
 */
export const ZV3PatchResponseBody = z
  .object({
    finished: createFields.finished.optional(),
    endingId: createFields.endingId,
    language: createFields.language,
    data: createFields.data.optional(),
    embeddedData: createFields.embeddedData,
    // No uniqueness refinement, matching the contract: the patch set is applied as a set, so a
    // repeated id is redundant rather than ambiguous.
    tags: z.array(z.cuid2()).optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: "At least one field must be provided" });
export type TV3PatchResponseBody = z.infer<typeof ZV3PatchResponseBody>;
