import { z } from "zod";
import { declareReference } from "./reference-manifest";

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
/**
 * Cardinality caps on a stored answer, per the ENG-1652 input policy — the same reason `tags` and the
 * batch-delete body are capped above.
 *
 * Both are far past any real survey: a multi-select answer holds at most one entry per choice, and a
 * response holds at most one entry per element. The point is that neither has a bound today, so a
 * single request inside the 2 MB body limit can store an array of tens of thousands of entries, and
 * every later reader pays for it per entry — the serializer's per-answer mapping, export columns, and
 * the positional probe the "Other" response filter emits (ENG-3161), whose window is sized from the
 * survey's choice count rather than from the stored array.
 *
 * v3-only, and additive: these are new endpoints with no callers. The same unbounded shape reaches
 * `ZResponseData` through the v1 and v2 write paths, where capping it would reject payloads that
 * work today — see this PR's open gaps.
 */
export const MAX_RESPONSE_DATA_VALUES = 1_000;
export const MAX_RESPONSE_DATA_KEYS = 500;

const ZV3ResponseDataValue = z.union([
  z.string(),
  z.number(),
  z.array(z.string()).max(MAX_RESPONSE_DATA_VALUES),
  z
    .record(z.string(), z.string())
    .refine((entries) => Object.keys(entries).length <= MAX_RESPONSE_DATA_VALUES, {
      message: `A matrix answer may hold at most ${MAX_RESPONSE_DATA_VALUES} rows`,
    }),
]);

/** Embedded Data accepts scalars only, plus `null` to clear a field. No arrays, no objects. */
const ZV3EmbeddedDataValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);

/**
 * The same key cap `data` carries, for the other two element-keyed maps on this body.
 *
 * `embeddedData` needs it for a second reason beyond storage: every name that matches no declared
 * field becomes its own `invalid_params` entry, and the entry repeats the name in both `name` and
 * `reason`. Uncapped, a 2 MB body of distinct short names answers with a 422 several times its own
 * size — the request is rejected, and the rejection is the expensive part. Only Hub-relayed
 * `invalid_params` are bounded (`hub-errors.ts`); locally generated ones are not.
 *
 * Free to apply here for the same reason the `data` cap is: these endpoints have no callers yet. The
 * v1 and v2 paths still take both maps unbounded, which stays an open gap rather than a silent
 * behaviour change.
 */
const withKeyCap = <T extends z.ZodType<Record<string, unknown>>>(schema: T, what: string) =>
  schema.refine((entries) => Object.keys(entries).length <= MAX_RESPONSE_DATA_KEYS, {
    message: `A response may carry at most ${MAX_RESPONSE_DATA_KEYS} ${what}`,
  });

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
  data: z
    .record(z.string(), ZV3ResponseDataValue)
    .refine((entries) => Object.keys(entries).length <= MAX_RESPONSE_DATA_KEYS, {
      message: `A response may answer at most ${MAX_RESPONSE_DATA_KEYS} fields`,
    }),
  embeddedData: withKeyCap(z.record(z.string(), ZV3EmbeddedDataValue), "Embedded Data fields").optional(),
  ttc: withKeyCap(ZV3ResponseTtcInput, "timing entries").optional(),
  meta: ZV3ResponseMetaInput.optional(),
  /**
   * Bounded like the batch-delete body in this same file. Without a cap one 2 MB request becomes a
   * `WHERE id IN (…)` of tens of thousands of ids plus that many join-row inserts, all inside the
   * write transaction.
   */
  tags: z
    .array(z.cuid2())
    .max(100)
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
/**
 * Every value on this body that names something outside it, declared once (ENG-2861).
 *
 * `reference-manifest.test.ts` reads the schema, not this list: a new id-shaped field, or one named
 * like a reference, fails there until it appears here. The point is that the set cannot grow quietly
 * — the twelve response BOLA fixes were each a field nobody knew was a reference.
 */
declareReference(createFields.surveyId, {
  kind: "fk",
  resolvedAgainst: "Survey, resolved and authorized by workspace before the write",
});
declareReference(createFields.contactId, {
  kind: "fk",
  resolvedAgainst: "Contact filtered by workspaceId, and connected scoped in the write",
});
declareReference(createFields.displayId, {
  kind: "fk",
  resolvedAgainst: "Display filtered by surveyId and unclaimed, and connected scoped in the write",
});
declareReference(createFields.tags, {
  kind: "fk",
  resolvedAgainst: "Tag filtered by workspaceId in one query, and connected scoped in the write",
});
declareReference(createFields.endingId, {
  kind: "document-local",
  resolvedAgainst: "the survey's own endings",
});
declareReference(createFields.language, {
  kind: "document-local",
  resolvedAgainst: "the survey's own enabled languages",
});
declareReference(createFields.data, {
  kind: "document-local",
  resolvedAgainst: "the survey's element ids; file-upload values additionally carry an embedded-id",
});
declareReference(createFields.embeddedData, {
  kind: "document-local",
  resolvedAgainst: "the survey's declared Embedded Data field names",
});
declareReference(createFields.singleUseId, {
  kind: "document-local",
  resolvedAgainst: "unused for this survey — a token, scoped by surveyId rather than owned elsewhere",
});

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
    // repeated id is redundant rather than ambiguous. The service deduplicates before writing the
    // join rows — without that, "redundant" was a composite-primary-key violation and a 500.
    tags: declareReference(z.array(z.cuid2()).max(100).optional(), {
      kind: "fk",
      resolvedAgainst: "Tag filtered by workspaceId in one query, and connected scoped in the write",
    }),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: "At least one field must be provided" });
export type TV3PatchResponseBody = z.infer<typeof ZV3PatchResponseBody>;

/**
 * `POST /api/v3/responses/validate`.
 *
 * Deliberately the same shape as `ZV3SurveyValidationRequestBody`: a union discriminated on
 * `operation`, each arm carrying the body the real call would take. The envelope is `.strict()` and
 * its failures are the endpoint's only 400 — `data` is `unknown` here precisely because problems
 * inside it are the point of the endpoint and come back as a `200` with `valid: false`.
 *
 * `data` is required rather than merely typed `unknown`: Zod treats an `unknown` field as
 * satisfiable by an absent key, so without the check `{ "operation": "create" }` would validate an
 * empty document and report it as a caller error rather than as the malformed envelope it is.
 */
const ZV3ValidationDocument = z.unknown().refine((value) => value !== undefined, {
  message: "Required",
});

/**
 * The envelope's own `responseId`, declared like any other reference (ENG-2861).
 *
 * A dry run resolves it exactly as a real patch does — `getResponseWorkspaceId`, then the scoped
 * read — so validate cannot be used to probe whether a response exists in someone else's workspace.
 * Declared on its own const rather than inline because the registry keys on the schema instance.
 */
const ZV3ValidationResponseId = declareReference(z.cuid2(), {
  kind: "fk",
  resolvedAgainst: "Response, via getResponseWorkspaceId then the workspace-scoped read",
});

declareReference(ZV3ValidationDocument, {
  kind: "document-local",
  resolvedAgainst: "the nested create or patch body, whose own fields carry their declarations",
});

export const ZV3ResponseValidationRequestBody = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("create"),
      data: ZV3ValidationDocument,
    })
    .strict(),
  z
    .object({
      operation: z.literal("patch"),
      responseId: ZV3ValidationResponseId,
      data: ZV3ValidationDocument,
    })
    .strict(),
]);
export type TV3ResponseValidationRequestBody = z.infer<typeof ZV3ResponseValidationRequestBody>;
