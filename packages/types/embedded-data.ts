import { z } from "zod";
import { isSafeIdentifier } from "./safe-identifier";

/** Longest allowed field key / name / storage key. */
export const EMBEDDED_DATA_NAME_MAX_LENGTH = 255;

/**
 * Where an Embedded Data field's value comes from.
 *
 * - `computed` — set inside the survey by logic (what used to be a "variable")
 * - `ingested` — arrives from outside via URL param or SDK (what used to be a "hidden field")
 * - `reserved` — auto-captured system metadata. Read-only, and never stored as a row:
 *   reserved fields are a static catalog in code (ENG-1839), globally available to every survey.
 */
export const ZEmbeddedDataSource = z.enum(["computed", "ingested", "reserved"]);

export type TEmbeddedDataSource = z.infer<typeof ZEmbeddedDataSource>;

export const ZEmbeddedDataType = z.enum(["string", "number", "boolean", "date"]);

export type TEmbeddedDataType = z.infer<typeof ZEmbeddedDataType>;

/**
 * A field's fallback value.
 * For `computed` fields this is the initial value; for `ingested` fields it is used
 * when nothing arrives from the URL or the SDK.
 */
export const ZEmbeddedDataDefaultValue = z.union([z.string(), z.number(), z.boolean()]).nullable();

export type TEmbeddedDataDefaultValue = z.infer<typeof ZEmbeddedDataDefaultValue>;

/**
 * One Embedded Data field definition, owned by a workspace.
 *
 * A field is either **local** (bespoke to a single survey) or **shared** (part of the
 * workspace library). Those two states move together with `surveyId` and `key`:
 * `isLocal === true` ⟺ `surveyId !== null` ⟺ `key === null`.
 */
export const ZEmbeddedData = z
  .object({
    id: z.cuid2(),
    createdAt: z.date(),
    updatedAt: z.date(),
    // Library name — workspace-unique and immutable. Null for local fields, which
    // aren't listed in the shared library and therefore have no library name.
    key: z
      .string()
      .max(EMBEDDED_DATA_NAME_MAX_LENGTH)
      .refine(isSafeIdentifier, "Key must start with a lowercase letter and contain only a-z, 0-9 and _")
      .nullable(),
    name: z.string().min(1).max(EMBEDDED_DATA_NAME_MAX_LENGTH),
    description: z.string().nullable(),
    source: ZEmbeddedDataSource,
    dataType: ZEmbeddedDataType.prefault("string"),
    defaultValue: ZEmbeddedDataDefaultValue,
    locked: z.boolean().prefault(false),
    isLocal: z.boolean().prefault(true),
    surveyId: z.cuid2().nullable(),
    workspaceId: z.cuid2(),
  })
  .superRefine((field, ctx) => {
    // A local field belongs to exactly one survey and has no library key;
    // a shared field has a library key and belongs to no single survey.
    if (field.isLocal) {
      if (field.surveyId === null) {
        ctx.addIssue({
          code: "custom",
          message: "A local field must belong to a survey",
          path: ["surveyId"],
        });
      }
      if (field.key !== null) {
        ctx.addIssue({
          code: "custom",
          message: "A local field must not have a library key",
          path: ["key"],
        });
      }
    } else {
      if (field.surveyId !== null) {
        ctx.addIssue({
          code: "custom",
          message: "A shared field must not belong to a single survey",
          path: ["surveyId"],
        });
      }
      if (field.key === null) {
        ctx.addIssue({
          code: "custom",
          message: "A shared field must have a library key",
          path: ["key"],
        });
      }
    }

    // Locking blocks writes from outside, which only ingested fields receive.
    if (field.locked && field.source !== "ingested") {
      ctx.addIssue({
        code: "custom",
        message: "Only ingested fields can be locked",
        path: ["locked"],
      });
    }

    // Reserved fields are read-only, so a default would never be used.
    if (field.source === "reserved" && field.defaultValue !== null) {
      ctx.addIssue({
        code: "custom",
        message: "Reserved fields are read-only and cannot have a default value",
        path: ["defaultValue"],
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
  });

export type TEmbeddedData = z.infer<typeof ZEmbeddedData>;

/**
 * Links a survey to an Embedded Data field, and records the key that field's value is
 * stored under inside that survey.
 *
 * `storageKey` is deliberately **not** validated as a safe identifier: migrated fields keep
 * their original address, which for a computed field is a cuid and for an ingested field can
 * be a legacy name containing uppercase letters or hyphens.
 */
export const ZSurveyEmbeddedData = z.object({
  id: z.cuid2(),
  surveyId: z.cuid2(),
  embeddedDataId: z.cuid2(),
  storageKey: z.string().min(1).max(EMBEDDED_DATA_NAME_MAX_LENGTH),
});

export type TSurveyEmbeddedData = z.infer<typeof ZSurveyEmbeddedData>;
