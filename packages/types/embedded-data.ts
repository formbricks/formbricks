import { z } from "zod";
import { isSafeIdentifier } from "./safe-identifier";
import { RESERVED_DECLARED_FIELD_NAMES } from "./surveys/validation";

/** Longest allowed field key / display name. */
export const EMBEDDED_DATA_NAME_MAX_LENGTH = 255;

/**
 * Where an Embedded Data field's value comes from.
 *
 * - `computed` — set inside the survey by logic (what used to be a "variable")
 * - `ingested` — arrives from outside via URL param or SDK (what used to be a "hidden field")
 * - `reserved` — auto-captured system metadata. Read-only, globally available to every survey, and
 *   **never stored as a row**: reserved fields are a static catalog in code (ENG-1839). The value
 *   lives in this enum so the resolver and the catalog share one vocabulary; `ZEmbeddedData`
 *   rejects it, because that schema describes a stored row.
 */
export const ZEmbeddedDataSource = z.enum(["computed", "ingested", "reserved"]);

export type TEmbeddedDataSource = z.infer<typeof ZEmbeddedDataSource>;

export const ZEmbeddedDataType = z.enum(["string", "number", "boolean", "date"]);

export type TEmbeddedDataType = z.infer<typeof ZEmbeddedDataType>;

/**
 * A field's fallback value.
 * For `computed` fields this is the initial value; for `ingested` fields it is used when nothing
 * arrives from the URL or the SDK. The runtime type has to agree with the field's `dataType` —
 * `ZEmbeddedData` enforces that, since `dataType` is what ingest coerces against.
 */
export const ZEmbeddedDataDefaultValue = z.union([z.string(), z.number(), z.boolean()]).nullable();

export type TEmbeddedDataDefaultValue = z.infer<typeof ZEmbeddedDataDefaultValue>;

/** A `date` default is stored as a string, so pin it to ISO 8601 — either a date or a datetime. */
const ZIsoDateOrDateTime = z.union([z.iso.date(), z.iso.datetime()]);

/** Runtime type each non-date `dataType` expects its default value to have. */
const DEFAULT_VALUE_TYPE_BY_DATA_TYPE = {
  string: "string",
  number: "number",
  boolean: "boolean",
} as const;

/**
 * One Embedded Data field definition, owned by a workspace.
 *
 * A field is either **local** (used by a single survey) or **shared** (part of the workspace
 * library). That isn't stored as a flag: `surveyId` is the owner and `key` is the library name, so a
 * local field has `surveyId` set and `key` null, and a shared field the other way round. Use
 * {@link isLocalEmbeddedData} rather than re-deriving it at each call site.
 */
export const ZEmbeddedData = z
  .object({
    id: z.cuid2(),
    createdAt: z.date(),
    updatedAt: z.date(),
    // Library name — workspace-unique and immutable. Null for local fields, which aren't listed in
    // the shared library and therefore have no library name.
    key: z
      .string()
      .max(EMBEDDED_DATA_NAME_MAX_LENGTH)
      .refine(isSafeIdentifier, "Key must start with a lowercase letter and contain only a-z, 0-9 and _")
      // A library key is always newly authored (local fields carry `key: null`), so it goes through
      // the strict create-time rule. Without this a shared ingested field could be keyed `verify` or
      // `lang`, and ingestion would then refuse to fill it — a field that can never hold a value.
      .refine((key) => !RESERVED_DECLARED_FIELD_NAMES.has(key.toLowerCase()), "Key is reserved")
      .nullable(),
    name: z.string().min(1).max(EMBEDDED_DATA_NAME_MAX_LENGTH),
    description: z.string().nullable(),
    source: ZEmbeddedDataSource,
    dataType: ZEmbeddedDataType.prefault("string"),
    defaultValue: ZEmbeddedDataDefaultValue,
    locked: z.boolean().prefault(false),
    surveyId: z.cuid2().nullable(),
    workspaceId: z.cuid2(),
  })
  .superRefine((field, ctx) => {
    // Reserved fields are a code catalog, never rows. Rejecting the value here keeps the row schema
    // honest about what can be persisted, and gives ENG-1839 an unambiguous starting point.
    if (field.source === "reserved") {
      ctx.addIssue({
        code: "custom",
        message: "Reserved fields are a code catalog and are never stored as rows",
        path: ["source"],
      });
    }

    // A local field belongs to exactly one survey and has no library key; a shared field has a
    // library key and belongs to no single survey. Exactly one of the two is always set.
    if (field.surveyId !== null && field.key !== null) {
      ctx.addIssue({
        code: "custom",
        message: "A field owned by a survey is local and must not have a library key",
        path: ["key"],
      });
    }
    if (field.surveyId === null && field.key === null) {
      ctx.addIssue({
        code: "custom",
        message: "A field must either belong to a survey or have a library key",
        path: ["key"],
      });
    }

    // Locking blocks writes from outside, which only ingested fields receive.
    if (field.locked && field.source !== "ingested") {
      ctx.addIssue({
        code: "custom",
        message: "Only ingested fields can be locked",
        path: ["locked"],
      });
    }

    // The logic engine can only calculate strings and numbers.
    if (field.source === "computed" && field.dataType !== "string" && field.dataType !== "number") {
      ctx.addIssue({
        code: "custom",
        message: "Computed fields support only string or number",
        path: ["dataType"],
      });
    }

    // `dataType` is what ingest coerces against, so a default that disagrees with it would surface
    // far from here — as a wrong value in the resolver, or a coercion failure at ingest.
    if (field.defaultValue !== null) {
      if (field.dataType === "date") {
        const isIsoString =
          typeof field.defaultValue === "string" && ZIsoDateOrDateTime.safeParse(field.defaultValue).success;
        if (!isIsoString) {
          ctx.addIssue({
            code: "custom",
            message: "A date field's default value must be an ISO 8601 date or datetime string",
            path: ["defaultValue"],
          });
        }
      } else {
        const expectedType = DEFAULT_VALUE_TYPE_BY_DATA_TYPE[field.dataType];
        if (typeof field.defaultValue !== expectedType) {
          ctx.addIssue({
            code: "custom",
            message: `A ${field.dataType} field's default value must be a ${expectedType}`,
            path: ["defaultValue"],
          });
        }
      }
    }
  });

export type TEmbeddedData = z.infer<typeof ZEmbeddedData>;

/**
 * True when the field is used by a single survey rather than being part of the workspace library.
 * Derived from `surveyId` so there is no stored flag to drift out of step.
 */
export const isLocalEmbeddedData = (field: Pick<TEmbeddedData, "surveyId">): boolean =>
  field.surveyId !== null;

/**
 * Links a survey to an Embedded Data field, and records the key that field's value is stored under
 * inside that survey.
 *
 * `workspaceId` is part of both foreign keys in the schema, so a survey cannot link a field defined
 * in another workspace.
 *
 * `storageKey` is deliberately **not** validated as a safe identifier, has no length cap, and does
 * not exclude reserved names: migrated fields keep their original address, which for a computed
 * field is a cuid and for an ingested field can be a legacy name with uppercase letters or hyphens.
 * Any restriction here that `ZSurveyHiddenFields.fieldIds` doesn't also impose would fail the
 * ENG-1835 backfill on a name a survey is currently using. The strict rule belongs on the create
 * path — see `RESERVED_DECLARED_FIELD_NAMES` and the third enforcement point on ENG-1839.
 */
export const ZSurveyEmbeddedData = z.object({
  id: z.cuid2(),
  workspaceId: z.cuid2(),
  surveyId: z.cuid2(),
  embeddedDataId: z.cuid2(),
  storageKey: z.string().refine((key) => key.trim().length > 0, "Storage key must not be blank"),
});

export type TSurveyEmbeddedData = z.infer<typeof ZSurveyEmbeddedData>;
