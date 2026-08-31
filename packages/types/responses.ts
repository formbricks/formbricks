import { z } from "zod";
import { ZId } from "./common";
import { ZSurveyQuota } from "./quota";
import { ZSurvey } from "./surveys/types";
import { ZTag } from "./tags";

export const ZResponseDataValue = z
  .union([z.string(), z.number(), z.array(z.string()), z.record(z.string(), z.string())])
  .optional();

export const ZResponseFilterCondition = z.enum([
  "accepted",
  "clicked",
  "submitted",
  "skipped",
  "equals",
  "notEquals",
  "lessThan",
  "lessEqual",
  "greaterThan",
  "greaterEqual",
  "includesAll",
  "includesOne",
  "uploaded",
  "notUploaded",
  "booked",
  "isCompletelySubmitted",
  "isPartiallySubmitted",
  "isEmpty",
  "isNotEmpty",
  "isAnyOf",
  "contains",
  "doesNotContain",
  "startsWith",
  "doesNotStartWith",
  "endsWith",
  "doesNotEndWith",
]);

export type TResponseDataValue = z.infer<typeof ZResponseDataValue>;

export const ZResponseData = z.record(z.string(), ZResponseDataValue);

export type TResponseData = z.infer<typeof ZResponseData>;

export const ZResponseVariables = z.record(z.string(), z.union([z.string(), z.number()]));

export type TResponseVariables = z.infer<typeof ZResponseVariables>;

export const ZResponseTtc = z.record(z.string(), z.number());

export type TResponseTtc = z.infer<typeof ZResponseTtc>;

// Per-element time-to-complete (ttc, in ms) is attacker-controlled telemetry on the public
// response endpoints. We sanitize each measurement at the schema boundary: z.number() already
// rejects NaN/Infinity, and we clamp the remaining finite values into [0, MAX_RESPONSE_TTC] so
// negative or absurdly large numbers can no longer skew analytics or overflow the summed
// `_total`. Clamping rather than rejecting means a real submission is never dropped over a
// noisy timing value — a question is only briefly "active", so anything past a day is
// meaningless rather than a reason to reject the response. Stored/returned responses keep the
// unbounded ZResponseTtc so historical data still parses.
export const MAX_RESPONSE_TTC = 1000 * 60 * 60 * 24; // 24 hours per element

export const ZResponseTtcInput = z.record(
  z.string(),
  z.number().transform((value) => Math.min(Math.max(value, 0), MAX_RESPONSE_TTC))
);

export type TResponseTtcInput = z.infer<typeof ZResponseTtcInput>;

export const ZResponseContactAttributes = z.record(z.string(), z.string()).nullable();

export type TResponseContactAttributes = z.infer<typeof ZResponseContactAttributes>;

export const ZSurveyContactAttributes = z.record(z.string(), z.array(z.string()));

export type TSurveyContactAttributes = z.infer<typeof ZSurveyContactAttributes>;

export const ZSurveyMetaFieldFilter = z.record(z.string(), z.array(z.string()));

export type TSurveyMetaFieldFilter = z.infer<typeof ZSurveyMetaFieldFilter>;

export const ZResponseHiddenFieldsFilter = z.record(z.string(), z.array(z.string()));

export type TResponseHiddenFieldsFilter = z.infer<typeof ZResponseHiddenFieldsFilter>;

const ZResponseFilterCriteriaDataLessThan = z.object({
  op: z.literal(ZResponseFilterCondition.enum.lessThan),
  value: z.number(),
});

const ZResponseFilterCriteriaDataLessEqual = z.object({
  op: z.literal(ZResponseFilterCondition.enum.lessEqual),
  value: z.number(),
});

const ZResponseFilterCriteriaDataGreaterEqual = z.object({
  op: z.literal(ZResponseFilterCondition.enum.greaterEqual),
  value: z.number(),
});

const ZResponseFilterCriteriaDataGreaterThan = z.object({
  op: z.literal(ZResponseFilterCondition.enum.greaterThan),
  value: z.number(),
});

const ZResponseFilterCriteriaDataIncludesOne = z.object({
  op: z.literal(ZResponseFilterCondition.enum.includesOne),
  value: z.union([z.array(z.string()), z.array(z.number())]),
});

const ZResponseFilterCriteriaDataIncludesAll = z.object({
  op: z.literal(ZResponseFilterCondition.enum.includesAll),
  value: z.array(z.string()),
});

const ZResponseFilterCriteriaDataEquals = z.object({
  op: z.literal(ZResponseFilterCondition.enum.equals),
  value: z.union([z.string(), z.number()]),
});

const ZResponseFilterCriteriaDataNotEquals = z.object({
  op: z.literal(ZResponseFilterCondition.enum.notEquals),
  value: z.union([z.string(), z.number()]),
});

const ZResponseFilterCriteriaDataAccepted = z.object({
  op: z.literal(ZResponseFilterCondition.enum.accepted),
});

const ZResponseFilterCriteriaDataClicked = z.object({
  op: z.literal(ZResponseFilterCondition.enum.clicked),
});

const ZResponseFilterCriteriaDataSubmitted = z.object({
  op: z.literal(ZResponseFilterCondition.enum.submitted),
});

const ZResponseFilterCriteriaDataSkipped = z.object({
  op: z.literal(ZResponseFilterCondition.enum.skipped),
});

const ZResponseFilterCriteriaDataUploaded = z.object({
  op: z.literal(ZResponseFilterCondition.enum.uploaded),
});

const ZResponseFilterCriteriaDataNotUploaded = z.object({
  op: z.literal(ZResponseFilterCondition.enum.notUploaded),
});

const ZResponseFilterCriteriaDataBooked = z.object({
  op: z.literal(ZResponseFilterCondition.enum.booked),
});

const ZResponseFilterCriteriaMatrix = z.object({
  op: z.literal("matrix"),
  value: z.record(z.string(), z.string()),
});

const ZResponseFilterCriteriaIsEmpty = z.object({
  op: z.literal(ZResponseFilterCondition.enum.isEmpty),
});

const ZResponseFilterCriteriaIsNotEmpty = z.object({
  op: z.literal(ZResponseFilterCondition.enum.isNotEmpty),
});

const ZResponseFilterCriteriaIsAnyOf = z.object({
  op: z.literal(ZResponseFilterCondition.enum.isAnyOf),
  value: z.record(z.string(), z.array(z.string())),
});

const ZResponseFilterCriteriaContains = z.object({
  op: z.literal(ZResponseFilterCondition.enum.contains),
  value: z.string(),
});

const ZResponseFilterCriteriaDoesNotContain = z.object({
  op: z.literal(ZResponseFilterCondition.enum.doesNotContain),
  value: z.string(),
});

const ZResponseFilterCriteriaStartsWith = z.object({
  op: z.literal(ZResponseFilterCondition.enum.startsWith),
  value: z.string(),
});

const ZResponseFilterCriteriaDoesNotStartWith = z.object({
  op: z.literal(ZResponseFilterCondition.enum.doesNotStartWith),
  value: z.string(),
});

const ZResponseFilterCriteriaEndsWith = z.object({
  op: z.literal(ZResponseFilterCondition.enum.endsWith),
  value: z.string(),
});

const ZResponseFilterCriteriaDoesNotEndWith = z.object({
  op: z.literal(ZResponseFilterCondition.enum.doesNotEndWith),
  value: z.string(),
});

const ZResponseFilterCriteriaFilledOut = z.object({
  op: z.literal("filledOut"),
});

const ZQuotasFilterCriteriaScreenedIn = z.object({
  op: z.literal("screenedIn"),
});

const ZQuotasFilterCriteriaScreenedOut = z.object({
  op: z.literal("screenedOut"),
});

const ZQuotasFilterCriteriaScreenedOutNotInQuota = z.object({
  op: z.literal("screenedOutNotInQuota"),
});

export const ZResponseFilterCriteria = z.object({
  finished: z.boolean().optional(),
  responseIds: z.array(ZId).optional(),
  createdAt: z
    .object({
      min: z.date().optional(),
      max: z.date().optional(),
    })
    .optional(),

  contactAttributes: z
    .record(
      z.string(),
      z.object({
        op: z.enum(["equals", "notEquals"]),
        value: z.union([z.string(), z.number()]),
      })
    )
    .optional(),

  data: z
    .record(
      z.string(),
      z.union([
        ZResponseFilterCriteriaDataLessThan,
        ZResponseFilterCriteriaDataLessEqual,
        ZResponseFilterCriteriaDataGreaterEqual,
        ZResponseFilterCriteriaDataGreaterThan,
        ZResponseFilterCriteriaDataIncludesOne,
        ZResponseFilterCriteriaDataIncludesAll,
        ZResponseFilterCriteriaDataEquals,
        ZResponseFilterCriteriaDataNotEquals,
        ZResponseFilterCriteriaDataAccepted,
        ZResponseFilterCriteriaDataClicked,
        ZResponseFilterCriteriaDataSubmitted,
        ZResponseFilterCriteriaDataSkipped,
        ZResponseFilterCriteriaDataUploaded,
        ZResponseFilterCriteriaDataNotUploaded,
        ZResponseFilterCriteriaDataBooked,
        ZResponseFilterCriteriaMatrix,
        ZResponseFilterCriteriaIsEmpty,
        ZResponseFilterCriteriaIsNotEmpty,
        ZResponseFilterCriteriaIsAnyOf,
        ZResponseFilterCriteriaFilledOut,
      ])
    )
    .optional(),

  tags: z
    .object({
      applied: z.array(z.string()).optional(),
      notApplied: z.array(z.string()).optional(),
    })
    .optional(),

  others: z
    .record(
      z.string(),
      z.object({
        op: z.enum(["equals", "notEquals"]),
        value: z.union([z.string(), z.number()]),
      })
    )
    .optional(),

  meta: z
    .record(
      z.string(),
      z.union([
        ZResponseFilterCriteriaDataEquals,
        ZResponseFilterCriteriaDataNotEquals,
        ZResponseFilterCriteriaContains,
        ZResponseFilterCriteriaDoesNotContain,
        ZResponseFilterCriteriaStartsWith,
        ZResponseFilterCriteriaDoesNotStartWith,
        ZResponseFilterCriteriaEndsWith,
        ZResponseFilterCriteriaDoesNotEndWith,
      ])
    )
    .optional(),

  quotas: z
    .record(
      ZId,
      z.union([
        ZQuotasFilterCriteriaScreenedIn,
        ZQuotasFilterCriteriaScreenedOut,
        ZQuotasFilterCriteriaScreenedOutNotInQuota,
      ])
    )
    .optional(),
});

export const ZResponseContact = z.object({
  id: ZId,
  userId: z.string().optional(),
});

export type TResponseContact = z.infer<typeof ZResponseContact>;

export type TResponseFilterCriteria = z.infer<typeof ZResponseFilterCriteria>;

/**
 * The browser-runtime context the survey renderer snapshots once, at display time, and attaches to
 * every write of the response (ENG-1841). Kept as its own schema because three shapes need exactly
 * this set of keys and must not drift: the stored `ZResponseMeta`, the ingest input
 * `ZResponseInput.meta`, and the renderer-to-queue `ZResponseUpdate.meta`.
 *
 * Every key is optional, and deliberately so on two counts. Responses collected before this shipped
 * carry none of them and must keep validating — there is no migration and nothing to backfill, since
 * the values only ever existed in a browser that has long since closed. And a live capture is
 * best-effort per key: a runtime without `Intl` or `screen` omits that key rather than storing a
 * placeholder, so "absent" always reads as "we could not observe this", never as an empty string.
 *
 * Both link and app surveys render through the same component, so all of these are captured for
 * both. Their *meaning* differs: on a link survey they describe the Formbricks-hosted survey page
 * and how the respondent arrived at it; on an app survey they describe the host page the survey was
 * triggered on.
 */
export const ZAutoCapturedResponseMeta = z.object({
  /** `location.pathname` — the query-free page identity analytics usually groups on. */
  pagePath: z.string().optional(),
  /** `document.referrer`. Empty when there is no referrer, which we omit rather than store as "". */
  pageReferrer: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmTerm: z.string().optional(),
  utmContent: z.string().optional(),
  /** Physical screen, in CSS pixels (`screen.width`/`screen.height`). */
  screenWidth: z.number().optional(),
  screenHeight: z.number().optional(),
  /** Visible viewport, in CSS pixels (`window.innerWidth`/`innerHeight`). Frozen at display. */
  viewportWidth: z.number().optional(),
  viewportHeight: z.number().optional(),
  /** IANA zone from `Intl.DateTimeFormat().resolvedOptions().timeZone`, e.g. `Europe/Berlin`. */
  timezone: z.string().optional(),
  /**
   * The device's configured locale from `navigator.language`, e.g. `de-AT`. Not validated as a BCP-47
   * tag: what the runtime reports is the finding, and rejecting an unusual tag would store nothing
   * rather than something imperfect.
   */
  locale: z.string().optional(),
});

export type TAutoCapturedResponseMeta = z.infer<typeof ZAutoCapturedResponseMeta>;

export const ZResponseMeta = ZAutoCapturedResponseMeta.extend({
  source: z.string().optional(),
  url: z.string().optional(),
  userAgent: z
    .object({
      browser: z.string().optional(),
      os: z.string().optional(),
      device: z.string().optional(),
    })
    .optional(),
  country: z.string().optional(),
  action: z.string().optional(),
  ipAddress: z.string().optional(),
});

export type TResponseMeta = z.infer<typeof ZResponseMeta>;

/**
 * The client-supplied half of `meta`, narrowed to exactly the auto-captured keys.
 *
 * Both client ingest routes rebuild `meta` from scratch rather than passing the caller's object
 * through, because these endpoints are public and anything not explicitly re-listed must not reach
 * the database. That whitelist is hand-written in the route, which is how a field could be added to
 * the schema, captured by the SDK, accepted by the parser — and then silently dropped one line
 * before the write. Deriving this part of it from the schema instead means the auto-captured list
 * cannot fall behind the shape it is supposed to mirror.
 *
 * Only the keys a browser can honestly observe live here. `country`, `userAgent` and `ipAddress`
 * stay out: the routes derive those from the request itself and must keep overriding whatever the
 * client claimed.
 */
export const pickAutoCapturedResponseMeta = (meta: TResponseMeta | undefined): TAutoCapturedResponseMeta =>
  ZAutoCapturedResponseMeta.parse(meta ?? {});

export const ZResponse = z.object({
  id: z.cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  surveyId: z.cuid2(),
  displayId: z.string().nullish(),
  contact: ZResponseContact.nullable(),
  contactAttributes: ZResponseContactAttributes,
  finished: z.boolean(),
  endingId: z.string().nullish(),
  data: ZResponseData,
  variables: ZResponseVariables,
  ttc: ZResponseTtc.optional(),
  tags: z.array(ZTag),
  meta: ZResponseMeta,
  singleUseId: z.string().nullable(),
  language: z.string().nullable(),
});

export type TResponse = z.infer<typeof ZResponse>;

export const ZResponseInput = z.object({
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  workspaceId: z.cuid2(),
  surveyId: z.cuid2(),
  userId: z.string().nullish(),
  displayId: z.string().nullish(),
  singleUseId: z.string().nullable().optional(),
  pinAuthToken: z.string().nullish(),
  // The survey client already sends this on every create (see `response-queue.ts`), but it used to be
  // absent from this schema, so Zod stripped it before the v1 handler could enforce the reCAPTCHA gate.
  recaptchaToken: z.string().nullish(),
  finished: z.boolean(),
  endingId: z.string().nullish(),
  language: z.string().optional(),
  data: ZResponseData,
  variables: ZResponseVariables.optional(),
  ttc: ZResponseTtcInput.optional(),
  // The same shape as the stored `ZResponseMeta`, and now literally it: this used to be a hand-copied
  // duplicate, which is how a field added to one could pass review and still fail to parse on the way
  // in. The ingest routes rebuild `meta` from a whitelist afterwards, so accepting a key here is not
  // the same as trusting it — `country`, `userAgent` and `ipAddress` are always re-derived server-side.
  meta: ZResponseMeta.optional(),
});

export type TResponseInput = z.infer<typeof ZResponseInput>;

export const ZResponseUpdateInput = z.object({
  finished: z.boolean().optional(),
  endingId: z.string().nullish(),
  data: ZResponseData.optional(),
  variables: ZResponseVariables.optional(),
  ttc: ZResponseTtcInput.optional(),
  language: z.string().optional(),
  pinAuthToken: z.string().nullish(),
});

export type TResponseUpdateInput = z.infer<typeof ZResponseUpdateInput>;

export const ZResponseWithSurvey = ZResponse.extend({
  survey: ZSurvey,
});

export type TResponseWithSurvey = z.infer<typeof ZResponseWithSurvey>;

export const ZResponseHiddenFieldValue = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.array(z.string())])
);
export type TResponseHiddenFieldValue = z.infer<typeof ZResponseHiddenFieldValue>;

export const ZResponseUpdate = z.object({
  finished: z.boolean(),
  data: ZResponseData,
  language: z.string().optional(),
  variables: ZResponseVariables.optional(),
  ttc: ZResponseTtcInput.optional(),
  // Only what a browser can actually observe. The server-derived keys (`country`, `userAgent`,
  // `ipAddress`) stay out on purpose: this is the renderer-to-queue shape, and the renderer has no
  // business claiming a value the ingest route derives from the request itself.
  meta: ZAutoCapturedResponseMeta.extend({
    url: z.string().optional(),
    source: z.string().optional(),
    action: z.string().optional(),
  }).optional(),
  // `ZResponseData`, not the narrower `ZResponseHiddenFieldValue`: `ResponseQueue` merges this map
  // over `data` on every submit, so `data`'s value shape is literally its type. The renderer now
  // sends the record the ingest contract produced (ENG-1845), which — like `data` — can carry a
  // question answer's shape for a key that collided with an element id.
  hiddenFields: ZResponseData.optional(),
  displayId: z.string().nullish(),
  endingId: z.string().nullish(),
});

export type TResponseUpdate = z.infer<typeof ZResponseUpdate>;

export const ZResponseTableData = z.object({
  responseId: z.string(),
  singleUseId: z.string().nullable(),
  createdAt: z.date(),
  status: z.string(),
  verifiedEmail: z.string(),
  tags: z.array(ZTag),
  language: z.string().nullable(),
  responseData: ZResponseData,
  variables: z.record(z.string(), z.union([z.string(), z.number()])),
  person: ZResponseContact.nullable(),
  contactAttributes: ZResponseContactAttributes,
  meta: ZResponseMeta,
  /**
   * Reserved-field values already resolved and rendered, keyed by column id (ENG-2540). Precomputed
   * on the row like `variables` and `responseData`, rather than read out of `meta` by a per-column
   * switch: resolution belongs to the catalog's own accessors, which apply the `redactQuery` policy
   * and the dataType coercion, and `meta` alone cannot express a field that is not stored under its
   * own name (`deviceType` lives at `meta.userAgent.device`).
   */
  reservedValues: z.record(z.string(), z.string()),
  quotas: z.array(z.string()).optional(),
});

export type TResponseTableData = z.infer<typeof ZResponseTableData>;

export const ZResponseWithQuotas = ZResponse.extend({
  quotas: z.array(ZSurveyQuota.pick({ id: true, name: true })).optional(),
});

export type TResponseWithQuotas = z.infer<typeof ZResponseWithQuotas>;
