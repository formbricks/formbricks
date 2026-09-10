import { z } from "zod";

/**
 * Executable mirror of the response payload the v3 contract publishes.
 *
 * The spec under `docs/api-v3-reference/src/` is hand-authored YAML, and hand-maintained YAML against
 * hand-written mapping code is the one seam nothing guards — contract drift is the dominant defect
 * class on this resource, with five storage-shape errors and six Embedded Data errors already found
 * that way. These schemas are the left-hand side of `resources.spec-drift.test.ts`, which asserts
 * exact set equality against the YAML in both directions, so a field added on one side and not the
 * other fails a test rather than shipping.
 *
 * They are also the serializer's return types, which means the mapping code cannot compile while it
 * disagrees with the contract. Nothing validates at runtime on the read path — the serializer is the
 * only producer and parsing its own output on every row would cost a Zod pass per response for no
 * information a test does not already have.
 */

/** Every element type the current survey model defines. Mirrors `TSurveyElementTypeEnum`. */
export const V3_ELEMENT_TYPES = [
  "openText",
  "multipleChoiceSingle",
  "multipleChoiceMulti",
  "nps",
  "rating",
  "csat",
  "ces",
  "consent",
  "pictureSelection",
  "cta",
  "date",
  "fileUpload",
  "cal",
  "matrix",
  "address",
  "ranking",
  "contactInfo",
] as const;

/**
 * How a stored value was resolved against the current survey definition.
 *
 * `unmatched` is deliberately not folded into `other`: a renamed option and a genuine write-in are
 * byte-identical as stored, so reclassifying one as the other would report a fact the data does not
 * support. See the contract's own note on `ResponseValueMatch`.
 */
export const ZV3ResponseValueMatch = z.enum(["exact", "label", "other", "unmatched"]);
export type TV3ResponseValueMatch = z.infer<typeof ZV3ResponseValueMatch>;

export const ZV3ResponseSelection = z
  .object({
    optionId: z.string().nullable(),
    optionLabel: z.string().nullable(),
    rawValue: z.string(),
    match: ZV3ResponseValueMatch,
    /** `ranking` only. Array order already carries it; this makes the rank explicit. */
    rank: z.number().int().min(1).optional(),
  })
  .strict();
export type TV3ResponseSelection = z.infer<typeof ZV3ResponseSelection>;

/**
 * Sub-field ids for the two composite element types, in storage order.
 *
 * The order is load-bearing rather than cosmetic: `address` and `contactInfo` are stored as
 * positional `string[]` of fixed length (6 and 5), so a slot index only means anything against this
 * list. Dropping a blank slot would shift every later value onto the wrong field.
 */
export const V3_ADDRESS_FIELD_IDS = [
  "addressLine1",
  "addressLine2",
  "city",
  "state",
  "zip",
  "country",
] as const;
export const V3_CONTACT_INFO_FIELD_IDS = ["firstName", "lastName", "email", "phone", "company"] as const;
export const V3_COMPOSITE_FIELD_IDS = [...V3_ADDRESS_FIELD_IDS, ...V3_CONTACT_INFO_FIELD_IDS] as const;

const answerBase = {
  position: z.number().int().min(1),
  elementId: z.string(),
  elementLabel: z.string(),
  /** Clamped to 24h per element at the write boundary; client-reported, so an indication only. */
  durationSeconds: z.number().min(0).max(86_400).optional(),
};

const ZV3ResponseAnswerText = z
  .object({
    ...answerBase,
    elementType: z.literal("openText"),
    valueText: z.string(),
    /** The value is always a string, `number` inputs included — this says how it was validated. */
    inputType: z.enum(["text", "email", "url", "number", "phone"]).optional(),
  })
  .strict();

const ZV3ResponseAnswerNumber = z
  .object({
    ...answerBase,
    elementType: z.enum(["nps", "rating", "csat", "ces"]),
    valueNumber: z.number(),
    /** Required because a bare `8` is uninterpretable, and because scales are editable over time. */
    range: z.object({ min: z.number(), max: z.number() }).strict(),
    /** Absent for `nps`, which has no scale presentation. */
    scale: z.enum(["number", "smiley", "star"]).optional(),
  })
  .strict();

const ZV3ResponseAnswerBoolean = z
  .object({
    ...answerBase,
    elementType: z.enum(["consent", "cta"]),
    valueBoolean: z.boolean(),
    /** The stored token. Returned because the boolean is a derivation and this is the fact. */
    rawValue: z.string(),
  })
  .strict();

const ZV3ResponseAnswerSelection = z
  .object({
    ...answerBase,
    elementType: z.enum(["multipleChoiceSingle", "multipleChoiceMulti", "pictureSelection", "ranking"]),
    /** Always an array, `multipleChoiceSingle` included, so consumers need one code path. */
    selections: z.array(ZV3ResponseSelection),
  })
  .strict();

const ZV3ResponseAnswerDate = z
  .object({
    ...answerBase,
    elementType: z.literal("date"),
    /** Stored precision varies by client version, so no format is asserted. Parse defensively. */
    valueDate: z.string(),
  })
  .strict();

const ZV3ResponseAnswerFileUpload = z
  .object({
    ...answerBase,
    elementType: z.literal("fileUpload"),
    fileUrls: z.array(z.string()),
    fileCount: z.number().int().min(0).optional(),
  })
  .strict();

const ZV3ResponseAnswerBooking = z
  .object({
    ...answerBase,
    elementType: z.literal("cal"),
    booked: z.boolean(),
    rawValue: z.string(),
  })
  .strict();

const ZV3ResponseAnswerMatrix = z
  .object({
    ...answerBase,
    elementType: z.literal("matrix"),
    rows: z.array(
      z
        .object({
          /**
           * The stored key verbatim — the localized row label in the *respondent's* language, which
           * is what rebuilds the stored object. Not necessarily equal to `rowLabel`, which resolves
           * in the current definition's language.
           */
          rawKey: z.string(),
          rowId: z.string().nullable().optional(),
          rowLabel: z.string(),
          columnId: z.string().nullable().optional(),
          columnLabel: z.string().nullable(),
          rawValue: z.string(),
          match: ZV3ResponseValueMatch,
        })
        .strict()
    ),
  })
  .strict();

const ZV3ResponseAnswerComposite = z
  .object({
    ...answerBase,
    elementType: z.enum(["address", "contactInfo"]),
    /** Every slot in storage order, blanks included — see `V3_COMPOSITE_FIELD_IDS`. */
    fields: z.array(
      z
        .object({
          slot: z.number().int().min(0),
          fieldId: z.enum(V3_COMPOSITE_FIELD_IDS),
          fieldLabel: z.string(),
          valueText: z.string(),
        })
        .strict()
    ),
  })
  .strict();

/**
 * Nine value shapes across seventeen element types, discriminated on `elementType`.
 *
 * Switch on `elementType` rather than probing for which value field is present: several types share
 * a shape (the four numeric scales, the four choice styles, the two composites) and the shared ones
 * are indistinguishable by their fields alone.
 */
export const ZV3ResponseAnswer = z.discriminatedUnion("elementType", [
  ZV3ResponseAnswerText,
  ZV3ResponseAnswerNumber,
  ZV3ResponseAnswerBoolean,
  ZV3ResponseAnswerSelection,
  ZV3ResponseAnswerDate,
  ZV3ResponseAnswerFileUpload,
  ZV3ResponseAnswerBooking,
  ZV3ResponseAnswerMatrix,
  ZV3ResponseAnswerComposite,
]);
export type TV3ResponseAnswer = z.infer<typeof ZV3ResponseAnswer>;

export const ZV3ResponseEmbeddedDatum = z
  .object({
    /**
     * The link's storage key — the same string that addresses the value in `data` (ingested) or
     * `variables` (computed), or the catalog entry name (reserved). For a variable that is its cuid,
     * never its human name, which rides on `label`.
     */
    key: z.string(),
    kind: z.enum(["ingested", "computed", "reserved"]),
    type: z.enum(["string", "number", "boolean", "date"]),
    label: z.string(),
    /** No `null` member: a key that resolves to nothing is omitted from the collection entirely. */
    value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
  })
  .strict();
export type TV3ResponseEmbeddedDatum = z.infer<typeof ZV3ResponseEmbeddedDatum>;

export const ZV3ResponseUnresolvedEntry = z
  .object({
    key: z.string(),
    /**
     * Whatever was stored, returned rather than dropped — the point is that it is not discarded.
     *
     * The four shapes are the ones `Response.data` can hold: a scalar, a number, the string array a
     * multi-select or ranking stores, and the label-keyed record a matrix stores. Not `z.unknown()`:
     * that accepts `undefined`, which would make the field optional here while the contract requires
     * it, and it would express none of the four.
     */
    rawValue: z.union([z.string(), z.number(), z.array(z.string()), z.record(z.string(), z.string())]),
    reason: z.enum([
      "elementNotInSurvey",
      "hiddenFieldNotInSurvey",
      "variableNotInSurvey",
      "valueShapeMismatch",
    ]),
  })
  .strict();
export type TV3ResponseUnresolvedEntry = z.infer<typeof ZV3ResponseUnresolvedEntry>;

export const ZV3ResponseResolution = z
  .object({
    labelPolicy: z.literal("currentSurveyDefinition"),
    /** The public BCP-47 code, never the internal `default` key. `null` when the survey has none. */
    labelsLanguage: z.string().nullable(),
    surveyUpdatedAt: z.iso.datetime(),
  })
  .strict();
export type TV3ResponseResolution = z.infer<typeof ZV3ResponseResolution>;

export const ZV3ResponseTag = z.object({ id: z.string(), name: z.string() }).strict();
export type TV3ResponseTag = z.infer<typeof ZV3ResponseTag>;

export const ZV3ResponseContact = z
  .object({ id: z.string(), userId: z.string().nullable().optional() })
  .strict();
export type TV3ResponseContact = z.infer<typeof ZV3ResponseContact>;

const responseBase = {
  id: z.string(),
  surveyId: z.string(),
  surveyName: z.string(),
  workspaceId: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  finished: z.boolean(),
  endingId: z.string().nullable(),
  language: z.string().nullable(),
  /** Summed from the real per-element timing, excluding the stored `_total` bucket. */
  durationSeconds: z.number().min(0).optional(),
  resolution: ZV3ResponseResolution,
  answers: z.array(ZV3ResponseAnswer),
  embeddedData: z.array(ZV3ResponseEmbeddedDatum),
  unresolved: z.array(ZV3ResponseUnresolvedEntry),
  tags: z.array(ZV3ResponseTag),
};

/** The list view. Carries `answers` and `embeddedData` too, or a list forces an N+1 of item GETs. */
export const ZV3ResponseListItem = z.object(responseBase).strict();
export type TV3ResponseListItem = z.infer<typeof ZV3ResponseListItem>;

/**
 * The detailed view: the list item plus the five fields a single-row read adds.
 *
 * `data` and `variables` are **not** `readOnly` — they are exactly what the write endpoints accept,
 * so a client round-tripping a response needs them writable. Only the server-managed fields carry
 * `readOnly`.
 */
export const ZV3ResponseResource = z
  .object({
    ...responseBase,
    contact: ZV3ResponseContact.nullable(),
    displayId: z.string().nullable(),
    singleUseId: z.string().nullable(),
    /** The same four shapes `unresolved[].rawValue` carries — this is the map it is drawn from. */
    data: z.record(
      z.string(),
      z.union([z.string(), z.number(), z.array(z.string()), z.record(z.string(), z.string())])
    ),
    variables: z.record(z.string(), z.union([z.string(), z.number()])),
  })
  .strict();
export type TV3ResponseResource = z.infer<typeof ZV3ResponseResource>;
