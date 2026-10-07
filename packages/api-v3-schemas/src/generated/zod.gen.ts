// GENERATED FILE — do not edit. Source of truth: docs/api-v3-reference/src/ (bundled to openapi.yml).
// Regenerate with `pnpm api:v3:schemas`; CI verifies freshness with `pnpm api:v3:schemas:check`.
// Scope: V3 Responses — see packages/api-v3-schemas/scripts/adopted.ts.
import * as z from "zod";

/**
 * The pagination half of a v3 list's `meta`, shared by every paginated collection.
 *
 * Deliberately open, and never an endpoint's `meta` by itself: an endpoint composes it with `allOf` and closes the result with `unevaluatedProperties: false`. A base that closed itself could not be extended — inside an `allOf`, `additionalProperties: false` sees a sibling branch's properties as additional and rejects them. An endpoint that adds nothing still wraps it, so no `meta` anywhere is open.
 *
 * Every field here is `required`. A shared envelope that makes its fields optional is how v3's predecessor stopped honouring its own pagination contract without the schema gate noticing (ENG-2622): `meta: {}` — or no `meta` at all — validated cleanly while the endpoint returned nothing.
 */
export const zListPaginationMeta = z.object({
  limit: z.int().gte(1),
  nextCursor: z.string().nullable(),
});

export type ListPaginationMetaZodType = z.infer<typeof zListPaginationMeta>;

/**
 * Field-level validation error. `name` and `reason` are always intended for humans.
 * Optional machine-readable fields are included when the API can identify the semantic error,
 * especially for survey locale, identifier, and reference validation used by MCP and agent clients.
 *
 */
export const zInvalidParam = z.strictObject({
  name: z.string(),
  reason: z.string(),
  code: z
    .enum([
      "dangling_reference",
      "duplicate_identifier",
      "duplicate_locale",
      "forbidden_identifier",
      "immutable_identifier",
      "invalid_locale",
      "invalid_reference",
      "missing_required_field",
      "misordered_reference",
      "missing_translation",
      "read_only_field",
      "unsupported_field",
      "unsupported_locale",
    ])
    .optional(),
  identifier: z.string().optional(),
  referenceType: z
    .enum(["block", "element", "ending", "hiddenField", "language", "variable", "variableName", "recall"])
    .optional(),
  missingId: z.string().optional(),
  firstUsedAt: z.string().optional(),
  conflictsWith: z.string().optional(),
});

export type InvalidParamZodType = z.infer<typeof zInvalidParam>;

/**
 * RFC 9457 Problem Details for HTTP APIs (`application/problem+json`). Responses typically include a machine-readable `code` field alongside `title`, `status`, `detail`, and `requestId`.
 *
 * Branch on `code`, not on `detail` or `title`: `code` is stable and locale-independent, whereas `detail` is prose that may be reworded. No problem sets `type`, so per RFC 9457 §4.2.1 `title` is always the HTTP reason phrase for `status` and carries no information of its own.
 *
 * Member naming is frozen as published, mixed conventions included (`requestId` alongside `invalid_params` and `details.resource_type`): renaming any of them would break every client that reads them.
 */
export const zProblem = z.object({
  type: z.url().optional(),
  title: z.string(),
  status: z.int(),
  detail: z.string(),
  instance: z.string().optional(),
  code: z
    .enum([
      "ai_features_not_enabled",
      "ai_generated_payload_invalid",
      "ai_instance_not_configured",
      "ai_output_too_long",
      "ai_provider_auth_failed",
      "ai_smart_tools_disabled",
      "bad_gateway",
      "bad_request",
      "conflict",
      "custom_css_plan_required",
      "forbidden",
      "internal_server_error",
      "invalid_workflow_state",
      "not_authenticated",
      "not_found",
      "payload_too_large",
      "projection_pending",
      "service_unavailable",
      "stored_survey_invalid",
      "survey_not_workspace_visible",
      "too_many_requests",
      "unprocessable_content",
      "visibility_blocked_by_connections",
      "visibility_change_not_allowed",
      "visibility_not_enabled",
      "workflow_not_executable",
      "workspace_survey_limit_reached",
    ])
    .optional(),
  requestId: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
  invalid_params: z.array(zInvalidParam).optional(),
});

export type ProblemZodType = z.infer<typeof zProblem>;

/**
 * Receipt describing how `answers[]` and `embeddedData[]` labels were produced. It exists so a consumer can tell whether the labels it is reading are the wording the respondent actually saw.
 *
 */
export const zResponseResolution = z.strictObject({
  labelPolicy: z.enum(["currentSurveyDefinition"]),
  labelsLanguage: z.string().nullable(),
  surveyUpdatedAt: z.iso.datetime({ offset: true }),
});

export type ResponseResolutionZodType = z.infer<typeof zResponseResolution>;

/**
 * Fields every answer carries, whatever the element type. `elementType` selects the value-bearing shape — see `ResponseAnswer`.
 */
export const zResponseAnswerBase = z.object({
  position: z.int().gte(1),
  elementId: z.string(),
  elementType: z.enum([
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
  ]),
  elementLabel: z.string(),
  durationSeconds: z.number().gte(0).lte(86400).optional(),
});

export type ResponseAnswerBaseZodType = z.infer<typeof zResponseAnswerBase>;

/**
 * Free-text answer to an `openText` element.
 */
export const zResponseAnswerText = z.strictObject({
  position: z.int().gte(1),
  elementId: z.string(),
  elementType: z.enum(["openText"]),
  elementLabel: z.string(),
  durationSeconds: z.number().gte(0).lte(86400).optional(),
  valueText: z.string(),
  inputType: z.enum(["text", "email", "url", "number", "phone"]).optional(),
});

export type ResponseAnswerTextZodType = z.infer<typeof zResponseAnswerText>;

/**
 * Numeric-scale answer. Covers `nps` (0–10), `rating` (configurable range and presentation), `csat` and `ces`.
 */
export const zResponseAnswerNumber = z.strictObject({
  position: z.int().gte(1),
  elementId: z.string(),
  elementType: z.enum(["nps", "rating", "csat", "ces"]),
  elementLabel: z.string(),
  durationSeconds: z.number().gte(0).lte(86400).optional(),
  valueNumber: z.number(),
  range: z.strictObject({
    min: z.number(),
    max: z.number(),
  }),
  scale: z.enum(["number", "smiley", "star"]).optional(),
});

export type ResponseAnswerNumberZodType = z.infer<typeof zResponseAnswerNumber>;

/**
 * Acknowledgement answer. Covers `consent` (accepted) and `cta` (clicked through). A `cta` element the respondent skipped has no entry in `answers[]` at all.
 */
export const zResponseAnswerBoolean = z.strictObject({
  position: z.int().gte(1),
  elementId: z.string(),
  elementType: z.enum(["consent", "cta"]),
  elementLabel: z.string(),
  durationSeconds: z.number().gte(0).lte(86400).optional(),
  valueBoolean: z.boolean(),
  rawValue: z.string(),
});

export type ResponseAnswerBooleanZodType = z.infer<typeof zResponseAnswerBoolean>;

/**
 * How a stored raw value was resolved against the current survey definition. Precedence is fixed and applied in this order:
 *
 * - `exact` — the stored value matched an option **id** in the current definition.
 * - `label` — the stored value matched an option's **label text** (ids are stable, labels are
 * editable and language-dependent, so a label match is weaker evidence).
 *
 * - `other` — the value arrived through the element's **Other** free-text input. Only reported when
 * the element actually has that input enabled and the value was submitted through it.
 *
 * - `unmatched` — no option resolves. The raw value is still returned; it is **not** silently
 * reclassified as `other`, because a *renamed* option is also unmatched text and filing it as a
 * write-in would misattribute the answer.
 *
 */
export const zResponseValueMatch = z.enum(["exact", "label", "other", "unmatched"]);

export type ResponseValueMatchZodType = z.infer<typeof zResponseValueMatch>;

/**
 * One selected option within a choice-style answer. `optionId` plus `rawValue` is deliberately a two-field split — the same split the Hub stores as `value_id` plus `value_text` — because option ids are stable while labels are editable and language-dependent. Consumers that need to group or compare across time should key on `optionId`; consumers rendering to a human should use `optionLabel`.
 *
 */
export const zResponseSelection = z.strictObject({
  optionId: z.string().nullable(),
  optionLabel: z.string().nullable(),
  rawValue: z.string(),
  match: zResponseValueMatch,
  rank: z.int().gte(1).optional(),
});

export type ResponseSelectionZodType = z.infer<typeof zResponseSelection>;

/**
 * Choice-style answer. Covers `multipleChoiceSingle`, `multipleChoiceMulti`, `pictureSelection` and `ranking`. See `ResponseValueMatch` for how each selection was resolved and why an unresolvable value is never reclassified as a write-in.
 */
export const zResponseAnswerSelection = z.strictObject({
  position: z.int().gte(1),
  elementId: z.string(),
  elementType: z.enum(["multipleChoiceSingle", "multipleChoiceMulti", "pictureSelection", "ranking"]),
  elementLabel: z.string(),
  durationSeconds: z.number().gte(0).lte(86400).optional(),
  selections: z.array(zResponseSelection),
});

export type ResponseAnswerSelectionZodType = z.infer<typeof zResponseAnswerSelection>;

/**
 * Date answer.
 */
export const zResponseAnswerDate = z.strictObject({
  position: z.int().gte(1),
  elementId: z.string(),
  elementType: z.enum(["date"]),
  elementLabel: z.string(),
  durationSeconds: z.number().gte(0).lte(86400).optional(),
  valueDate: z.string(),
});

export type ResponseAnswerDateZodType = z.infer<typeof zResponseAnswerDate>;

/**
 * File-upload answer.
 */
export const zResponseAnswerFileUpload = z.strictObject({
  position: z.int().gte(1),
  elementId: z.string(),
  elementType: z.enum(["fileUpload"]),
  elementLabel: z.string(),
  durationSeconds: z.number().gte(0).lte(86400).optional(),
  fileUrls: z.array(z.string()),
  fileCount: z.int().gte(0).optional(),
});

export type ResponseAnswerFileUploadZodType = z.infer<typeof zResponseAnswerFileUpload>;

/**
 * Scheduling answer for a `cal` element. Only the fact of the booking is recorded on the response; the meeting itself lives in the scheduling provider and is not proxied by this API.
 */
export const zResponseAnswerBooking = z.strictObject({
  position: z.int().gte(1),
  elementId: z.string(),
  elementType: z.enum(["cal"]),
  elementLabel: z.string(),
  durationSeconds: z.number().gte(0).lte(86400).optional(),
  booked: z.boolean(),
  rawValue: z.string(),
});

export type ResponseAnswerBookingZodType = z.infer<typeof zResponseAnswerBooking>;

/**
 * Matrix answer — one selected column per answered row.
 */
export const zResponseAnswerMatrix = z.strictObject({
  position: z.int().gte(1),
  elementId: z.string(),
  elementType: z.enum(["matrix"]),
  elementLabel: z.string(),
  durationSeconds: z.number().gte(0).lte(86400).optional(),
  rows: z.array(
    z.strictObject({
      rawKey: z.string(),
      rowId: z.string().nullish(),
      rowLabel: z.string(),
      columnId: z.string().nullish(),
      columnLabel: z.string().nullable(),
      rawValue: z.string(),
      match: zResponseValueMatch,
    })
  ),
});

export type ResponseAnswerMatrixZodType = z.infer<typeof zResponseAnswerMatrix>;

/**
 * Composite answer whose value is a set of labelled sub-fields. Covers `address` and `contactInfo`. Stored as a positional array of strings, which is why every slot is reported.
 */
export const zResponseAnswerComposite = z.strictObject({
  position: z.int().gte(1),
  elementId: z.string(),
  elementType: z.enum(["address", "contactInfo"]),
  elementLabel: z.string(),
  durationSeconds: z.number().gte(0).lte(86400).optional(),
  fields: z.array(
    z.strictObject({
      slot: z.int().gte(0),
      fieldId: z.enum([
        "addressLine1",
        "addressLine2",
        "city",
        "state",
        "zip",
        "country",
        "firstName",
        "lastName",
        "email",
        "phone",
        "company",
      ]),
      fieldLabel: z.string(),
      valueText: z.string(),
    })
  ),
});

export type ResponseAnswerCompositeZodType = z.infer<typeof zResponseAnswerComposite>;

/**
 * One answer, carrying the element's id, its label, its type and its value. `elementType` selects the shape: switch on it rather than probing for which value field is present.
 *
 * Answers are a **typed array**, not a map keyed by element id, because a consumer holding only a response would otherwise see bare ids and have to fetch the survey and join to learn what was asked — a join that is easy to get wrong and that agent clients cannot make cheaply. The array also separates answers from hidden fields and variables, which the stored representation mixes into one flat map. Non-answer data lives in `embeddedData[]`.
 *
 * Several element types share a value shape and therefore a schema — the four numeric scales, the four choice styles, the two composites. All seventeen element types are covered.
 *
 * Only elements the respondent actually reached appear here. Data whose element has since been deleted appears in `unresolved[]` instead.
 *
 */
export const zResponseAnswer = z.union([
  zResponseAnswerText,
  zResponseAnswerNumber,
  zResponseAnswerBoolean,
  zResponseAnswerSelection,
  zResponseAnswerDate,
  zResponseAnswerFileUpload,
  zResponseAnswerBooking,
  zResponseAnswerMatrix,
  zResponseAnswerComposite,
]);

export type ResponseAnswerZodType = z.infer<typeof zResponseAnswer>;

/**
 * One piece of non-answer data carried by the response. Survey **variables**, **hidden fields** and **auto-captured context** are one concept here rather than three parallel ones: they all have a key, a provenance, a declared type and a label, and consumers treat them alike.
 *
 * Auto-captured (`reserved`) entries are drawn from the Embedded Data field catalog, which declares a privacy policy per field (`keep` / `drop` / `redactQuery`). Two of those act **before** this API sees the response, and one is a rule this API adds:
 *
 * - `drop` is an **ingest-time** policy, not a filter applied here: when the survey has "Anonymize
 * responses" enabled the field is never captured, so it is absent from the response for every
 * consumer. With anonymization off it is captured and appears here normally.
 *
 * - `redactQuery` is applied on **every** read, anonymization or not — `url` and `pageReferrer` carry
 * their query string stripped.
 *
 * - `ipAddress` is **never** projected by this API, in any view. That is a v3 rule rather than a
 * catalog behaviour: the catalog reads the field, and the dashboard shows it. Do not infer the same
 * suppression for the other `drop` fields.
 *
 *
 * Where a survey's own field and a catalog entry share a name, both appear — the declared one as `ingested` or `computed`, the auto-captured one as `reserved` — and `kind` is what tells them apart. Neither shadows the other, because each is a real value the response carries and dropping one would hide data the author can see elsewhere.
 *
 * Which catalog entries appear at all is a third axis, `display`, and this collection carries the ones that are not `none`. The `none` set is the response's own identity and timing — `responseId`, `surveyId`, `finished`, `language`, `durationSeconds`, `startedAt`, `finishedAt` — every one of which is already a first-class field on the response. Without that filter they would each appear twice in the same payload, once at the top level and once here.
 *
 */
export const zResponseEmbeddedDatum = z.strictObject({
  key: z.string(),
  kind: z.enum(["ingested", "computed", "reserved"]),
  type: z.enum(["string", "number", "boolean", "date"]),
  label: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

export type ResponseEmbeddedDatumZodType = z.infer<typeof zResponseEmbeddedDatum>;

/**
 * One stored answer or field value, in the four shapes the v3 contract can carry: a string, a number, a list of strings, or a string-to-string map.
 *
 * Declared once and referenced by `ResponseDataMap` and `ResponseUnresolvedEntry.rawValue`, so the two places that publish stored JSON cannot drift apart. A stored value outside these shapes (a legacy JSON `null`, an array with non-string items, a map with non-string values) is not published at all rather than reaching a client as a body this contract would reject.
 *
 */
export const zResponseRawValue = z.union([
  z.string(),
  z.number(),
  z.array(z.string()),
  z.record(z.string(), z.string()),
]);

export type ResponseRawValueZodType = z.infer<typeof zResponseRawValue>;

/**
 * Stored data that nothing in the current survey definition can account for. Deleting an element, a hidden field or a variable leaves its values behind on already-collected responses and nothing cleans them up, so the payload reports them here instead of dropping them silently or faking them into `answers[]` without a type or a label. Consumers doing analysis can ignore this array; consumers doing export or migration should not.
 *
 * **A declared field's `defaultValue` takes precedence over anything unreadable stored under its key**, and that is worth stating because this collection otherwise reads as exhaustive. Resolution falls back to the default before a value is ever judged unreadable, so a field that declares one always resolves — and the stored bytes, whatever their shape, are reported nowhere. Only a field with **no** `defaultValue` can reach `valueShapeMismatch`.
 * A **scalar** under a defaultless field is not reported either, and the cause is the reporting guard rather than `locked`. Only `resolveEmbeddedValue` consults the lock; the guard that decides what reaches this collection admits objects only. So an uncoercible scalar — `"yes"` under a boolean field — resolves to nothing and is then excluded for being a scalar, lock or no lock. A non-scalar under a lockless, defaultless field is what does reach `valueShapeMismatch`. Neither omission is a silent drop by accident — one follows from resolution order, the other from the reporting guard — and both are written down so a consumer does not read `unresolved[]` as a guarantee that nothing was left behind. If either proves to matter in practice a reason code can be added without breaking anyone, whereas removing one could not — which is why this is documentation rather than a guess at a fifth enum member.
 *
 */
export const zResponseUnresolvedEntry = z.strictObject({
  key: z.string(),
  rawValue: zResponseRawValue,
  reason: z.enum(["elementNotInSurvey", "variableNotInSurvey", "valueShapeMismatch"]),
});

export type ResponseUnresolvedEntryZodType = z.infer<typeof zResponseUnresolvedEntry>;

/**
 * A tag applied to a response, as a lightweight reference. Deliberately **not** the full `TagResource`: that shape carries a `count` of how many responses hold the tag, which would mean an extra aggregate per tag on every row of every page. Read tags in full — with counts and timestamps — from `GET /api/v3/tags`.
 *
 */
export const zResponseTag = z.strictObject({
  id: z.cuid2(),
  name: z.string(),
});

export type ResponseTagZodType = z.infer<typeof zResponseTag>;

/**
 * Fields shared by both response views. Self-describing: `answers[]` carries each element's id, label, type and value, so a consumer can read a response without also fetching the survey.
 *
 * Deliberately open — `ResponseListItem` and `ResponseResource` compose this and close themselves, so that the detailed view can add fields without the base rejecting them.
 *
 */
export const zResponseBase = z.object({
  id: z.cuid2(),
  surveyId: z.cuid2(),
  surveyName: z.string(),
  workspaceId: z.cuid2(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  finished: z.boolean(),
  endingId: z.string().nullable(),
  language: z.string().nullable(),
  durationSeconds: z.number().gte(0).optional(),
  resolution: zResponseResolution,
  answers: z.array(zResponseAnswer),
  embeddedData: z.array(zResponseEmbeddedDatum),
  unresolved: z.array(zResponseUnresolvedEntry),
  tags: z.array(zResponseTag),
});

export type ResponseBaseZodType = z.infer<typeof zResponseBase>;

/**
 * A survey response as returned by the list endpoint. Self-describing: `answers[]` carries each element's id, label, type and value, so a consumer can read a response without also fetching the survey.
 *
 * `answers[]` and `embeddedData[]` ship on the list view as well as the detailed view — they are the point of the resource, and withholding them from the list would force consumers into an N+1 of item reads. The list view omits only the identity and provenance fields: `contact`, `displayId` and `singleUseId`. See `ResponseResource` for those.
 *
 */
export const zResponseListItem = z.strictObject({
  id: z.cuid2(),
  surveyId: z.cuid2(),
  surveyName: z.string(),
  workspaceId: z.cuid2(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  finished: z.boolean(),
  endingId: z.string().nullable(),
  language: z.string().nullable(),
  durationSeconds: z.number().gte(0).optional(),
  resolution: zResponseResolution,
  answers: z.array(zResponseAnswer),
  embeddedData: z.array(zResponseEmbeddedDatum),
  unresolved: z.array(zResponseUnresolvedEntry),
  tags: z.array(zResponseTag),
});

export type ResponseListItemZodType = z.infer<typeof zResponseListItem>;

/**
 * The list `meta` for responses — pagination plus a bounded, opt-in total. Both counting fields are `required` but nullable, so `includeTotalCount=false` answers `null` rather than omitting them.
 */
export const zResponseListMeta = z.strictObject({
  limit: z.int().gte(1),
  nextCursor: z.string().nullable(),
  totalCount: z.int().gte(0).nullable(),
  totalCountRelation: z.enum(["eq", "gte"]).nullable(),
});

export type ResponseListMetaZodType = z.infer<typeof zResponseListMeta>;

/**
 * Answers as stored, **keyed by element id**.
 *
 * Hidden-field values do not live here. They are stored in the same underlying map, but that is a storage detail rather than part of this contract: a hidden field is an Embedded Data field, and Embedded Data is addressed by name through `embeddedData`.
 *
 * A hidden field's name appearing as a key here is rejected rather than silently written to the wrong namespace — with **422**, not 400, because knowing that a key names a hidden field means loading the survey, and these operations route every failure that needs stored state to 422. The problem carries `invalid_params[]` with `name` set to the offending key, `code: unsupported_field` and `referenceType: hiddenField`, so a client can point at it without parsing prose.
 *
 * A key that is **also** an element id is the exception, and it is **accepted**: the answer owns that address. Answers and hidden fields do share one slot, and the older surveys that declare a field named after a question have exactly one value under that key — but it is always the answer's. The field is dropped at ingest with `element_id_collision` (`packages/types/embedded-data-ingest.ts`) and filtered again in the renderer before it can reach a submission, precisely so a display-time field value cannot land on top of what the respondent answered. So on such a survey `answers[]` carries the value, `embeddedData` neither reports it nor accepts a write for it, and refusing the key here would block the only write that fits it.
 *
 * New surveys cannot reach that state through the editor or `POST`/`PATCH /api/v3/surveys`, which refuse an element id colliding with a declared field name. Both v1 management survey writes still accept one — that guard reads variable and hidden-field names but never element ids — so this set, unlike the reserved-name one, is still growing.
 *
 * Keeping the two apart is what lets the storage layout change underneath — the legacy columns go away eventually — without this contract either following it or breaking a round-trip it promised.
 *
 * The value shapes are the stored ones, and they differ by element type. `ResponseAnswer` documents each; `answers[]` on the read is the resolved view of this same map.
 *
 * **Bounds are a write-side concern and live on `ResponseDataMapInput`, not here.** This schema is the stored shape, and a read must describe what the API can actually return: the v1 and v2 write paths store this same map with no cardinality limit, so a response written through them can carry more keys — or a longer multi-select — than a v3 write would accept. Declaring the write bounds on this schema would make `GET /api/v3/responses/{responseId}` promise something it cannot keep for those rows.
 *
 */
export const zResponseDataMap = z.record(z.string(), zResponseRawValue);

export type ResponseDataMapZodType = z.infer<typeof zResponseDataMap>;

export const zResponseDataMapInput = zResponseDataMap;

export type ResponseDataMapInputZodType = z.infer<typeof zResponseDataMapInput>;

/**
 * Embedded Data values to write, **keyed by field name**.
 *
 * This is the write counterpart of `embeddedData[]` on the read, and it is keyed the way an author names a field rather than the way storage addresses it. A hidden field is stored under its name but a variable is stored under its cuid, and that split is an implementation detail of the storage layout — the server resolves a name to its storage key through the survey's Embedded Data links, so a caller never sees a cuid and never has to know which kind it is writing.
 *
 * **Which kinds are writable:**
 *
 * - `ingested` (hidden fields) — accepted, through the same ingest contract the SDK uses: the name
 * must be declared on the survey, the value is coerced to the field's declared `type`, a `locked`
 * field ignores the write, and the whole payload is bounded. A name the survey does not declare is
 * a **422** rather than a silent drop — knowing whether a name is declared means loading the
 * survey, and these operations route every failure that needs stored state to 422.
 *
 * - `computed` (variables) — accepted, because a management caller correcting a response needs to,
 * and v1 and v2 both allow it today.
 *
 * - `reserved` — refused. Auto-captured context describes the submission environment, and a
 * caller-supplied value would be fiction. The three exceptions are `source`, `url` and `action`,
 * which `ResponseMetaInput` accepts for exactly the replay case.
 *
 *
 * Values follow their field's declared type. A field the payload omits is left as it is; this is a merge over named fields, not a replacement of the collection.
 *
 * `null` **clears** a field. Omission and `null` therefore mean different things — leave it alone versus remove its value — which is the only reading that makes a merge-shaped map able to express deletion at all. A cleared field is then absent from `embeddedData[]` on the next read, exactly as one that was never written, and a field whose definition carries a `defaultValue` falls back to that default rather than disappearing.
 *
 * **An ambiguous name is refused.** The read says `key` is unique per `kind` rather than across the collection, because a survey predating the reserved-name guard can hold a variable and a hidden field under one name. This map has no `kind`, so on such a survey a name cannot say which field it means — and guessing would write the caller's value into the wrong one. A name that matches more than one declared field is a **422** naming it, for the same reason as an undeclared one; rename one side on the survey to clear it. The set is finite, frozen and tracked, and nothing new can enter it.
 *
 * Reserved names collide differently and are not ambiguous: `reserved` is not writable at all, so a name that matches both a declared field and a catalog entry resolves to the declared one.
 *
 * **At most 500 names.** Every name that matches no declared field becomes its own `invalid_params` entry naming it, so without a cap a large body answers with a 422 several times its own size. Far above any real survey; a v3-only bound, as on `data`.
 *
 */
export const zResponseEmbeddedDataInput = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean()]).nullable()
);

export type ResponseEmbeddedDataInputZodType = z.infer<typeof zResponseEmbeddedDataInput>;

/**
 * Per-element time-to-complete, keyed by element id, in **milliseconds**. Accepted on create so that a caller replaying a real submission can carry its timing; reads report the same information as `durationSeconds` in seconds, on each answer and summed at the top level.
 *
 * This is client-reported telemetry, not a measurement the server can vouch for, so each value is clamped into `[0, 86400000]` (24 hours per element) rather than rejected — a noisy timing value should never cost you the response. Any finite *value* is therefore accepted, and none is declared out of range.
 *
 * The number of **entries** is capped at 500, matching `data`: a response holds one timing per element, so anything beyond that is not telemetry the server can use. A map with more entries is **rejected** — `maxProperties` below is enforced during request validation, so the whole write fails rather than the excess being trimmed or stored.
 *
 * **Do not send a `_total` key.** The server owns that bucket: it drops any `_total` you supply and writes its own when the response is finished, by summing the element entries. Sending one therefore changes nothing rather than skewing the stored total, and `durationSeconds` on the read is computed from the element entries regardless.
 *
 * **An omitted map is not the same as an empty one.** Omitting `ttc` stores no timings at all and the response reports no `durationSeconds`; sending `{}` on a finished response stores a `_total` of zero, which reads as "completed instantly".
 *
 */
export const zResponseTtcMap = z.record(z.string(), z.number());

export type ResponseTtcMapZodType = z.infer<typeof zResponseTtcMap>;

/**
 * Submission context, on the narrow subset a caller can legitimately supply. A management-API create has no browser behind it, so unlike a client-side submission there is nothing for the server to auto-capture — if these are not sent they are simply absent, which is why the API accepts them at all rather than treating all context as server-derived.
 *
 * Deliberately **not** accepted here, because the routes derive them from the request itself and a caller-supplied value would be fiction: `country`, `userAgent` (the browser/OS/device breakdown is nested under it, there is no top-level `device` key) and `ipAddress`. `ipAddress` is additionally never projected by v3 on read, in any view.
 *
 * The stored `meta` is wider than this input. It also carries a block of browser-runtime context — `pagePath`, `pageReferrer`, the five `utm*` keys, the four screen/viewport dimensions, `timezone` and `locale` — which the SDK captures and which this endpoint does **not** currently accept, so sending one is a 400. That is a gap rather than a decision: an integration replaying a real submission can legitimately carry `utmSource` or `pagePath`, and those are live catalog entries that read back in `embeddedData[]`. Whether v3 create accepts them is open on the write ticket.
 *
 * Reads surface what is stored as `reserved` entries in `embeddedData[]`.
 *
 */
export const zResponseMetaInput = z.strictObject({
  source: z.string().max(512).optional(),
  url: z.string().max(2048).optional(),
  action: z.string().max(512).optional(),
});

export type ResponseMetaInputZodType = z.infer<typeof zResponseMetaInput>;

/**
 * Creates a survey response. **This is a real submission**: it runs the full response pipeline — webhooks, integrations, follow-ups, quota evaluation, and Hub ingestion once the response is finished — and it counts against metered monthly responses, exactly as a v1/v2 management create does today. It is not an import primitive; a dedicated import path is future work.
 *
 * The workspace is resolved from `surveyId`, so unlike `POST /api/v3/surveys` there is no `workspaceId` in the body — the caller cannot choose which scope it is authorized against.
 *
 * Unsupported fields are rejected rather than ignored. Absent by design, each for its own reason:
 *
 * - `createdAt` and `updatedAt` are **server-owned** — see `ResponseListItem.createdAt`. This is the
 * one capability v3 does not carry over from v2, and it is why bulk historical loading still
 * belongs on v2 until a dedicated import path exists.
 *
 * - `userId` is not accepted: a contact `userId` is a non-unique **attribute**, not a column, so it
 * cannot safely identify who to attribute a response to. Link the contact explicitly with
 * `contactId`.
 *
 * - `contactAttributes` is not accepted, and never was writable — v1/v2 snapshot it from the linked
 * contact. v3 does not expose the snapshot at all; `contact` covers the need.
 *
 * - `meta.ipAddress`, and the derived `userAgent` / `country` / `device` family, are not accepted;
 * see `ResponseMetaInput` for what is.
 *
 */
export const zCreateResponseRequest = z.strictObject({
  surveyId: z.cuid2(),
  finished: z.boolean(),
  data: zResponseDataMap,
  embeddedData: zResponseEmbeddedDataInput.optional(),
  ttc: zResponseTtcMap.optional(),
  meta: zResponseMetaInput.optional(),
  tags: z.array(z.cuid2()).max(100).optional(),
  endingId: z.string().nullish(),
  language: z.string().nullish(),
  contactId: z.cuid2().optional(),
  displayId: z.cuid2().optional(),
  singleUseId: z.string().min(1).max(255).optional(),
});

export type CreateResponseRequestZodType = z.infer<typeof zCreateResponseRequest>;

/**
 * The contact that submitted the response, when the response is identified. Present on the detailed view only — the list view omits it. `null` for anonymous (link-survey) responses.
 *
 */
export const zResponseContact = z.strictObject({
  id: z.cuid2(),
  userId: z.string().nullish(),
});

export type ResponseContactZodType = z.infer<typeof zResponseContact>;

/**
 * A survey response in the detailed view, as returned by `GET /api/v3/responses/{responseId}` and by the write endpoints. Everything in `ResponseListItem`, plus the identity and provenance fields the list view omits.
 *
 * It also carries `data` — the answers as stored, returned unchanged, so a client can read a response, edit an answer and send it straight back. Embedded Data is not echoed in stored form: the read's `embeddedData[]` and a request's `embeddedData` map already address the same fields by the same names, so a second raw map would only republish the storage layout. That is the property v1/v2 had for free by being symmetric, and the one OpenAPI 3.1.1 argues for directly: its "Validating `readOnly` and `writeOnly`" section notes that making clients strip fields before a write is "burdensome for clients, particularly when the JSON data is complex or deeply nested".
 *
 * They are not the *same* view, and the differences are deliberate. A write accepts `ingested` and `computed` fields only: a `reserved` entry describes the submission environment, and being able to read one back is not a licence to author it. An unset field is **omitted** from the read while `null` on a write **clears** one, because a merge-shaped map has no other way to spell deletion. And a name the read returns twice under different `kind`s cannot be written at all — see `ResponseEmbeddedDataInput`, which refuses an ambiguous name rather than guessing.
 *
 * Values themselves round-trip: within those two kinds every value the read emits is accepted verbatim on a write, and a `date` reads and writes as the same ISO-8601 string. So a read-edit-write cycle loses nothing except in two cases, both confined to rows v1 or v2 wrote. The first is the finite set of legacy surveys carrying one name as both a variable and a hidden field, where the write refuses the name outright. The second is a `data` map holding more keys than `ResponseDataMapInput` accepts: the stored map is unbounded and the write bound is not, so such a response cannot be patched here — and trimming it to fit is not a workaround, since `data` is replaced wholesale and an omitted key is a deletion.
 *
 * Note which fields carry `readOnly` here and which do not, because it is the opposite of what an "echo" framing would suggest. `readOnly` means a value is managed exclusively by the server, so it marks the **derived** views — `answers[]`, `embeddedData[]`, `unresolved[]`, `resolution`, the denormalized `surveyName` and `workspaceId`, the timestamps, `durationSeconds` and `id`. `data` is *not* read-only: it is exactly what the write endpoints accept, and leaving it unmarked is what makes this representation round-trippable rather than merely informative.
 *
 * To correct one answer, read this resource, take `data`, change the entry you want and `PATCH` `{ "data": … }`. Send only the fields you are changing — `PATCH` rejects unknown and non-patchable keys, so passing the whole representation back verbatim is not the intended flow; passing `data` back is.
 *
 * **Never exposed on this resource, in either view:** the respondent's IP address, and the `contactAttributes` snapshot that v1/v2 return. That snapshot is copied from the contact at submission time and never updated after, so it is stale PII by construction — `contact` covers the legitimate need to know who answered.
 *
 */
export const zResponseResource = z.strictObject({
  id: z.cuid2(),
  surveyId: z.cuid2(),
  surveyName: z.string(),
  workspaceId: z.cuid2(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  finished: z.boolean(),
  endingId: z.string().nullable(),
  language: z.string().nullable(),
  durationSeconds: z.number().gte(0).optional(),
  resolution: zResponseResolution,
  answers: z.array(zResponseAnswer),
  embeddedData: z.array(zResponseEmbeddedDatum),
  unresolved: z.array(zResponseUnresolvedEntry),
  tags: z.array(zResponseTag),
  data: zResponseDataMap,
  contact: zResponseContact.nullable(),
  displayId: z.string().nullable(),
  singleUseId: z.string().nullable(),
});

export type ResponseResourceZodType = z.infer<typeof zResponseResource>;

export const zValidateResponseCreateRequest = z.strictObject({
  operation: z.enum(["create"]),
  data: z.unknown(),
});

export type ValidateResponseCreateRequestZodType = z.infer<typeof zValidateResponseCreateRequest>;

export const zValidateResponsePatchRequest = z.strictObject({
  operation: z.enum(["patch"]),
  responseId: z.cuid2(),
  data: z.unknown(),
});

export type ValidateResponsePatchRequestZodType = z.infer<typeof zValidateResponsePatchRequest>;

export const zValidateResponseRequest = z.discriminatedUnion("operation", [
  zValidateResponseCreateRequest.extend({ operation: z.literal("create") }),
  zValidateResponsePatchRequest.extend({ operation: z.literal("patch") }),
]);

export type ValidateResponseRequestZodType = z.infer<typeof zValidateResponseRequest>;

/**
 * What a successful write **would** do, reported without doing it. This mirrors the detail that makes `POST /api/v3/surveys/validate` useful: it reports effects, not just a verdict, so a caller can see the consequences of a payload before committing thousands of them.
 *
 * Present only when `valid` is `true`.
 *
 */
export const zResponseValidationEffects = z.strictObject({
  language: z.string().nullable(),
  contactId: z.string().nullish(),
  displayId: z.string().nullish(),
  firesPipeline: z.boolean(),
  countsTowardMeteredResponses: z.boolean(),
  quotas: z
    .array(
      z.strictObject({
        quotaId: z.cuid2(),
        quotaName: z.string(),
        wouldCount: z.boolean(),
        wouldFill: z.boolean().optional(),
      })
    )
    .optional(),
  tagsToApply: z.array(z.cuid2()).optional(),
});

export type ResponseValidationEffectsZodType = z.infer<typeof zResponseValidationEffects>;

/**
 * Outcome of a dry-run validation. Deliberately the same shape as `SurveyValidationResult` — the value of this endpoint is that the two behave alike, so a client can treat validation uniformly.
 *
 * Answers are checked against the survey's own validation rules (`SurveyValidationRule`) rather than a parallel rule set, so a payload this endpoint accepts is a payload the real write accepts.
 *
 */
export const zResponseValidationResult = z.strictObject({
  valid: z.boolean(),
  operation: z.enum(["create", "patch"]),
  invalid_params: z.array(zInvalidParam),
  effects: zResponseValidationEffects.optional(),
});

export type ResponseValidationResultZodType = z.infer<typeof zResponseValidationResult>;

/**
 * Ids to delete. A POST custom method rather than a `DELETE` on the collection: a collection-level `DELETE` that loses its filters degrades into erasing every response in scope, and a distinct path cannot be reached by accident — which is exactly the shape `feedbackRecords` ships today, a collection `DELETE` whose filters are the only thing standing between a caller and the whole dataset. AIP-165 blesses the custom-method form.
 *
 */
export const zBatchDeleteResponsesRequest = z.strictObject({
  ids: z.array(z.cuid2()).min(1).max(100),
});

export type BatchDeleteResponsesRequestZodType = z.infer<typeof zBatchDeleteResponsesRequest>;

/**
 * Partially updates a response. Strict at the top level: unknown keys return **400** rather than being ignored, and at least one patchable field must be present.
 *
 * `data` is **replaced wholesale**, not deep-merged — send the complete answer map you want stored. `embeddedData` is the exception and merges by name: it addresses individual fields, so a field the payload omits keeps its value rather than being cleared.
 *
 * v3 replaces on purpose, where v1 and v2 merge: a merge makes it impossible to delete an answer, which a correction flow needs.
 *
 * **Every patch runs the response pipeline**, emitting `responseUpdated` — so webhooks, integrations and follow-ups fire for a correction as much as for a substantive edit. A patch that *transitions* the response to finished additionally emits `responseFinished`; one that patches an already-finished response does not re-emit it.
 *
 * Not patchable, and rejected if sent: `createdAt`, `updatedAt`, `surveyId`, `contactId`, `displayId`, `singleUseId`, `contactAttributes`, and the create-only `ttc` and `meta` — timing and submission context describe the original submission event, so they are set once and not revised. `contactId` is create-only deliberately — re-attributing an existing response to a different person is a capability only v2 offers, and it is not carried forward.
 *
 */
export const zPatchResponseRequest = z.strictObject({
  finished: z.boolean().optional(),
  endingId: z.string().nullish(),
  language: z.string().nullish(),
  data: zResponseDataMap.optional(),
  embeddedData: zResponseEmbeddedDataInput.optional(),
  tags: z.array(z.cuid2()).max(100).optional(),
});

export type PatchResponseRequestZodType = z.infer<typeof zPatchResponseRequest>;

/**
 * Workspace identifier. This is the canonical container ID for v3 APIs.
 */
export const zWorkspaceIdQuery = z.cuid2();

export type WorkspaceIdQueryZodType = z.infer<typeof zWorkspaceIdQuery>;

/**
 * Page size. A value above the maximum is rejected with **400** rather than silently reduced to it — v3 rejects unusable input instead of substituting its own, the same way it rejects unrecognized query parameters. The server may still return fewer items than requested, so treat `meta.nextCursor` as the only end-of-collection signal rather than comparing the page length against `limit`.
 */
export const zLimitQuery = z.int().gte(1).lte(250).default(20);

export type LimitQueryZodType = z.infer<typeof zLimitQuery>;

/**
 * Opaque cursor returned as `meta.nextCursor` from the previous page. Omit on the first request.
 */
export const zCursorQuery = z.string();

export type CursorQueryZodType = z.infer<typeof zCursorQuery>;

/**
 * Only records created at or after this instant (**inclusive**). Mutually exclusive with `filter[createdAt][gt]` — sending both is a **400**.
 */
export const zCreatedAtGteQuery = z.iso.datetime({ offset: true });

export type CreatedAtGteQueryZodType = z.infer<typeof zCreatedAtGteQuery>;

/**
 * Only records created strictly after this instant (**exclusive**). Paired with `filter[createdAt][lt]` this is a fully open `(start, end)` window. For a half-open `[start, end)` window — the one whose consecutive pages tile without dropping a record that sits exactly on a boundary instant — use `filter[createdAt][gte]` with `filter[createdAt][lt]`. Mutually exclusive with `filter[createdAt][gte]` — sending both is a **400**.
 */
export const zCreatedAtGtQuery = z.iso.datetime({ offset: true });

export type CreatedAtGtQueryZodType = z.infer<typeof zCreatedAtGtQuery>;

/**
 * Only records created at or before this instant (**inclusive**). Mutually exclusive with `filter[createdAt][lt]` — sending both is a **400**.
 */
export const zCreatedAtLteQuery = z.iso.datetime({ offset: true });

export type CreatedAtLteQueryZodType = z.infer<typeof zCreatedAtLteQuery>;

/**
 * Only records created strictly before this instant (**exclusive**). The upper bound of a half-open `[start, end)` window, which is what makes consecutive windows tile without overlapping or dropping a record on the boundary. Mutually exclusive with `filter[createdAt][lte]` — sending both is a **400**.
 */
export const zCreatedAtLtQuery = z.iso.datetime({ offset: true });

export type CreatedAtLtQueryZodType = z.infer<typeof zCreatedAtLtQuery>;

/**
 * Response identifier.
 */
export const zResponseIdPath = z.cuid2();

export type ResponseIdPathZodType = z.infer<typeof zResponseIdPath>;

export const zGetResponsesV3Query = z.object({
  workspaceId: z.cuid2(),
  limit: z.int().gte(1).lte(250).optional().default(20),
  cursor: z.string().optional(),
  surveyId: z.cuid2().optional(),
  contactId: z.cuid2().optional(),
  includeTotalCount: z.boolean().optional().default(false),
  "filter[createdAt][gte]": z.iso.datetime({ offset: true }).optional(),
  "filter[createdAt][gt]": z.iso.datetime({ offset: true }).optional(),
  "filter[createdAt][lte]": z.iso.datetime({ offset: true }).optional(),
  "filter[createdAt][lt]": z.iso.datetime({ offset: true }).optional(),
  "filter[finished][eq]": z.boolean().optional(),
  "filter[language][in]": z.array(z.string()).optional(),
  "filter[id][in]": z.array(z.cuid2()).max(100).optional(),
  sortBy: z.enum(["-createdAt", "createdAt"]).optional().default("-createdAt"),
});

export type GetResponsesV3QueryZodType = z.infer<typeof zGetResponsesV3Query>;

export const zCreateResponseV3Body = zCreateResponseRequest;

export type CreateResponseV3BodyZodType = z.infer<typeof zCreateResponseV3Body>;

export const zCountResponsesV3Query = z.object({
  workspaceId: z.cuid2(),
  surveyId: z.cuid2().optional(),
  contactId: z.cuid2().optional(),
  "filter[createdAt][gte]": z.iso.datetime({ offset: true }).optional(),
  "filter[createdAt][gt]": z.iso.datetime({ offset: true }).optional(),
  "filter[createdAt][lte]": z.iso.datetime({ offset: true }).optional(),
  "filter[createdAt][lt]": z.iso.datetime({ offset: true }).optional(),
  "filter[finished][eq]": z.boolean().optional(),
  "filter[language][in]": z.array(z.string()).optional(),
  "filter[id][in]": z.array(z.cuid2()).max(100).optional(),
  precision: z.enum(["capped", "exact"]).optional().default("capped"),
});

export type CountResponsesV3QueryZodType = z.infer<typeof zCountResponsesV3Query>;

export const zValidateResponseV3Body = zValidateResponseRequest;

export type ValidateResponseV3BodyZodType = z.infer<typeof zValidateResponseV3Body>;

export const zBatchDeleteResponsesV3Body = zBatchDeleteResponsesRequest;

export type BatchDeleteResponsesV3BodyZodType = z.infer<typeof zBatchDeleteResponsesV3Body>;

export const zBatchDeleteResponsesV3Query = z.object({
  workspaceId: z.cuid2(),
});

export type BatchDeleteResponsesV3QueryZodType = z.infer<typeof zBatchDeleteResponsesV3Query>;

export const zDeleteResponseV3Path = z.object({
  responseId: z.cuid2(),
});

export type DeleteResponseV3PathZodType = z.infer<typeof zDeleteResponseV3Path>;

export const zGetResponseV3Path = z.object({
  responseId: z.cuid2(),
});

export type GetResponseV3PathZodType = z.infer<typeof zGetResponseV3Path>;

export const zUpdateResponseV3Body = zPatchResponseRequest;

export type UpdateResponseV3BodyZodType = z.infer<typeof zUpdateResponseV3Body>;

export const zUpdateResponseV3Path = z.object({
  responseId: z.cuid2(),
});

export type UpdateResponseV3PathZodType = z.infer<typeof zUpdateResponseV3Path>;
