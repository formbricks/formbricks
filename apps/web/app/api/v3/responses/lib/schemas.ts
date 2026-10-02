import { z } from "zod";
import {
  zBatchDeleteResponsesRequest,
  zBatchDeleteResponsesV3Query,
  zCreateResponseRequest,
  zGetResponseV3Path,
  zPatchResponseRequest,
  zResponseDataMapInput,
  zResponseEmbeddedDataInput,
  zResponseTtcMap,
  zValidateResponseCreateRequest,
  zValidateResponsePatchRequest,
} from "@formbricks/api-v3-schemas";
import { declareReference } from "./reference-manifest";

/**
 * The request schemas of the v3 response routes.
 *
 * The shapes are generated from the contract (`@formbricks/api-v3-schemas`); this module adds what a
 * generated schema cannot carry, and nothing else:
 *
 * - the constraints the generator cannot express — `uniqueItems`, `minProperties`/`maxProperties`
 *   and the `if/then` value caps. Each one is pinned in the package's `EXPECTED_UNENFORCED`, and
 *   `write-schemas.test.ts` rejects a counterexample for every pin, so a constraint published on the
 *   contract cannot go unenforced here.
 * - the messages a caller reads in `invalid_params[].reason`.
 * - strictness for parameter objects, which the generator emits stripping because OpenAPI has no way to
 *   close a parameter list.
 * - the reference declarations of ENG-2861, which must sit on the exact instances the bodies expose.
 *
 * Compose first, refine last: Zod 4 refuses `.extend` over a key once a schema has refinements, and a
 * `.refine` clones its schema — so each declaration below targets the instance that ends up in the
 * final shape.
 */

/** `uniqueItems`, as a refinement. Shared with MCP tools that call the operations directly. */
export const hasUniqueItems = (values: readonly unknown[]): boolean => new Set(values).size === values.length;
export const RESPONSE_IDS_UNIQUE_MESSAGE = "Response ids must be unique";

/**
 * The response id is a path parameter, so it is validated here rather than trusted: an unparseable id
 * must answer 400 before any query runs, not 500 from Prisma (ENG-483 is that bug on the v1 route).
 * `GET`, `PATCH` and `DELETE` share the one `ResponseIdPath` parameter, so any of their path schemas
 * serves.
 */
export const ZV3ResponseIdParams = z.strictObject(zGetResponseV3Path.shape);
export type TV3ResponseIdParams = z.infer<typeof ZV3ResponseIdParams>;

/**
 * `POST /api/v3/responses/batch-delete`.
 *
 * The cap and the uniqueness rule are the contract's, and both are enforced here rather than left to
 * the service: an oversized batch must answer 400 before it reaches a `deleteMany`, and duplicates
 * would make `deleted` unreconcilable against `ids.length` for no benefit to the caller. The rule sits
 * on the array, not the body, so it still reports when another field of the body is also wrong.
 */
export const ZV3BatchDeleteResponsesQuery = z.strictObject(zBatchDeleteResponsesV3Query.shape);
export type TV3BatchDeleteResponsesQuery = z.infer<typeof ZV3BatchDeleteResponsesQuery>;

export const ZV3BatchDeleteResponsesBody = zBatchDeleteResponsesRequest.extend({
  ids: zBatchDeleteResponsesRequest.shape.ids.refine(hasUniqueItems, {
    message: RESPONSE_IDS_UNIQUE_MESSAGE,
  }),
});
export type TV3BatchDeleteResponsesBody = z.infer<typeof ZV3BatchDeleteResponsesBody>;

/**
 * Cardinality caps on a stored answer, per the ENG-1652 input policy — the same reason `tags` and the
 * batch-delete body are capped.
 *
 * Both are far past any real survey: a multi-select answer holds at most one entry per choice, and a
 * response holds at most one entry per element. Without them a single request inside the 2 MB body
 * limit can store an array of tens of thousands of entries, and every later reader pays for it per
 * entry — the serializer's per-answer mapping, export columns, and the positional probe the "Other"
 * response filter emits (ENG-3161), whose window is sized from the survey's choice count rather than
 * from the stored array.
 *
 * v3-only, and additive: the same unbounded shape reaches `ZResponseData` through the v1 and v2 write
 * paths, where capping it would reject payloads that work today.
 */
export const MAX_RESPONSE_DATA_VALUES = 1_000;
export const MAX_RESPONSE_DATA_KEYS = 500;

/**
 * `ResponseDataMapInput`: the stored answer map with the write-side bounds.
 *
 * The contract caps each value with `if/then` — an array at most 1000 items, a matrix at most 1000
 * rows — and the map with `maxProperties`. The value caps refine the generated value union and the
 * key cap refines the map, so a value that breaks a cap fails while the map is parsed and the key cap
 * then stays silent, as Zod skips an object-level refinement over a failed parse. The array cap raises
 * Zod's own `too_big` issue, so its `reason` reads the way a `.max()` would.
 */
const ZV3ResponseDataValue = zResponseDataMapInput.valueType.superRefine((value, ctx) => {
  if (Array.isArray(value)) {
    if (value.length > MAX_RESPONSE_DATA_VALUES) {
      ctx.addIssue({
        code: "too_big",
        origin: "array",
        maximum: MAX_RESPONSE_DATA_VALUES,
        inclusive: true,
        input: value,
      });
    }
  } else if (typeof value === "object" && Object.keys(value).length > MAX_RESPONSE_DATA_VALUES) {
    ctx.addIssue({
      code: "custom",
      input: value,
      message: `A matrix answer may hold at most ${MAX_RESPONSE_DATA_VALUES} rows`,
    });
  }
});

const ZV3ResponseDataInput = z
  .record(zResponseDataMapInput.keyType, ZV3ResponseDataValue)
  .refine((entries) => Object.keys(entries).length <= MAX_RESPONSE_DATA_KEYS, {
    message: `A response may answer at most ${MAX_RESPONSE_DATA_KEYS} fields`,
  });

/**
 * The same key cap `data` carries, for the other two element-keyed maps on this body.
 *
 * `embeddedData` needs it for a second reason beyond storage: every name that matches no declared
 * field becomes its own `invalid_params` entry, and the entry repeats the name in both `name` and
 * `reason`. Uncapped, a 2 MB body of distinct short names answers with a 422 several times its own
 * size — the request is rejected, and the rejection is the expensive part. Only Hub-relayed
 * `invalid_params` are bounded (`hub-errors.ts`); locally generated ones are not.
 */
const withKeyCap = <T extends z.ZodType<Record<string, unknown>>>(schema: T, what: string) =>
  schema.refine((entries) => Object.keys(entries).length <= MAX_RESPONSE_DATA_KEYS, {
    message: `A response may carry at most ${MAX_RESPONSE_DATA_KEYS} ${what}`,
  });

/** Embedded Data accepts scalars only, plus `null` to clear a field — per `ResponseEmbeddedDataInput`. */
const ZV3EmbeddedDataInput = withKeyCap(zResponseEmbeddedDataInput, "Embedded Data fields");

/**
 * Per-element timing, in milliseconds. Values are not bounded on purpose — the contract clamps rather
 * than rejects, because noisy client telemetry should never cost a caller their response. The clamp
 * lives in the service.
 */
const ZV3TtcInput = withKeyCap(zResponseTtcMap, "timing entries");

const createShape = zCreateResponseRequest.shape;
const patchShape = zPatchResponseRequest.shape;

/**
 * Bounded like the batch-delete body. Without the cap one 2 MB request becomes a `WHERE id IN (…)` of
 * tens of thousands of ids plus that many join-row inserts, all inside the write transaction. Unique on
 * create only, as the contract has it: a patch applies its tags as a set, and the service deduplicates
 * them before writing the join rows.
 */
const ZV3CreateTags = createShape.tags
  .unwrap()
  .refine(hasUniqueItems, { message: "Tag ids must be unique" })
  .optional();

/**
 * Every value on a body that names something outside it, declared once (ENG-2861).
 *
 * `reference-manifest.test.ts` reads the bodies, not this list: a new field — including one a spec edit
 * adds through generation — fails there until it is classified here. The point is that the set cannot
 * grow quietly: the twelve response BOLA fixes were each a field nobody knew was a reference.
 */
const fk = (resolvedAgainst: string) => ({ kind: "fk" as const, resolvedAgainst });
const local = (resolvedAgainst: string) => ({ kind: "document-local" as const, resolvedAgainst });
const TAGS_RESOLVED = "Tag filtered by workspaceId in one query, and connected scoped in the write";

declareReference(createShape.surveyId, fk("Survey, resolved and authorized by workspace before the write"));
declareReference(
  createShape.contactId,
  fk("Contact filtered by workspaceId, and connected scoped in the write")
);
declareReference(
  createShape.displayId,
  fk("Display filtered by surveyId and unclaimed, and connected scoped in the write")
);
declareReference(ZV3CreateTags, fk(TAGS_RESOLVED));
declareReference(patchShape.tags, fk(TAGS_RESOLVED));
for (const shape of [createShape, patchShape]) {
  declareReference(shape.endingId, local("the survey's own endings"));
  declareReference(shape.language, local("the survey's own enabled languages"));
}
declareReference(
  ZV3ResponseDataInput,
  local("the survey's element ids; file-upload values additionally carry an embedded-id")
);
declareReference(ZV3EmbeddedDataInput, local("the survey's declared Embedded Data field names"));
declareReference(
  createShape.singleUseId,
  local("unused for this survey — a token, scoped by surveyId rather than owned elsewhere")
);

/**
 * `POST /api/v3/responses`.
 *
 * Three required fields and nothing implied: `surveyId`, `finished` and `data`. Everything the
 * caller may not set is absent from the shape rather than stripped afterwards, so strictness turns an
 * attempt into a 400 naming the key instead of a silent drop — which is the difference between a
 * caller learning that `createdAt` is server-owned and one believing they backdated a response.
 */
export const ZV3CreateResponseBody = zCreateResponseRequest.extend({
  data: ZV3ResponseDataInput,
  embeddedData: ZV3EmbeddedDataInput.optional(),
  ttc: ZV3TtcInput.optional(),
  tags: ZV3CreateTags,
});
export type TV3CreateResponseBody = z.infer<typeof ZV3CreateResponseBody>;

/**
 * `PATCH /api/v3/responses/{responseId}`.
 *
 * Six patchable fields, and at least one of them — an empty body is a 400 rather than a no-op 200,
 * because a caller sending nothing has a bug and a 200 would hide it.
 */
export const ZV3PatchResponseBody = zPatchResponseRequest
  .extend({
    data: ZV3ResponseDataInput.optional(),
    embeddedData: ZV3EmbeddedDataInput.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: "At least one field must be provided" });
export type TV3PatchResponseBody = z.infer<typeof ZV3PatchResponseBody>;

/**
 * `POST /api/v3/responses/validate`.
 *
 * A union discriminated on `operation`, each arm carrying the body the real call would take, like
 * `ZV3SurveyValidationRequestBody`. The envelope is strict and its failures are the endpoint's only
 * 400 — `data` is any value precisely because problems inside it are the point of the endpoint and come
 * back as a `200` with `valid: false`.
 *
 * `data` is required rather than merely `unknown`: Zod treats an `unknown` field as satisfiable by an
 * absent key, so without the check `{ "operation": "create" }` would validate an empty document and
 * report it as a caller error rather than as the malformed envelope it is.
 */
const ZV3ValidationDocument = declareReference(
  z.unknown().refine((value) => value !== undefined, { message: "Required" }),
  local("the nested create or patch body, whose own fields carry their declarations")
);

/**
 * The envelope's own `responseId`. A dry run resolves it exactly as a real patch does —
 * `getResponseWorkspaceId`, then the scoped read — so validate cannot be used to probe whether a
 * response exists in someone else's workspace.
 */
declareReference(
  zValidateResponsePatchRequest.shape.responseId,
  fk("Response, via getResponseWorkspaceId then the workspace-scoped read")
);

export const ZV3ResponseValidationRequestBody = z.discriminatedUnion("operation", [
  zValidateResponseCreateRequest.extend({ operation: z.literal("create"), data: ZV3ValidationDocument }),
  zValidateResponsePatchRequest.extend({ operation: z.literal("patch"), data: ZV3ValidationDocument }),
]);
export type TV3ResponseValidationRequestBody = z.infer<typeof ZV3ResponseValidationRequestBody>;
