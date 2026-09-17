import { z } from "zod";
import {
  type TEmbeddedData,
  ZEmbeddedDataDefaultValue,
  ZEmbeddedDataSource,
  ZEmbeddedDataType,
} from "@formbricks/types/embedded-data";
import { InvalidInputError, OperationNotAllowedError } from "@formbricks/types/errors";
import { ZSurveyStatus } from "@formbricks/types/surveys/types";

/**
 * A shared (library) Embedded Data field: the same row as a local one, narrowed to the half of the
 * `key` / `surveyId` pair that the library holds. `ZEmbeddedData` already refuses any other
 * combination; this type is what lets a reader stop re-checking it.
 */
export type TSharedEmbeddedData = Omit<TEmbeddedData, "key" | "surveyId"> & {
  key: string;
  surveyId: null;
};

/** A library row as the manager lists it — the definition plus how many surveys link it. */
export type TSharedEmbeddedDataListItem = TSharedEmbeddedData & { surveyCount: number };

/** One survey that links a field. Enough to render the usage popover without a second fetch. */
export const ZEmbeddedDataUsageItem = z.object({
  id: z.cuid2(),
  name: z.string(),
  status: ZSurveyStatus,
});

export type TEmbeddedDataUsageItem = z.infer<typeof ZEmbeddedDataUsageItem>;

/**
 * What a caller may supply when adding a field to the library.
 *
 * Deliberately only the columns an author picks: `key` and `source` are here because they are set
 * once, and `surveyId` is absent because a library field belongs to no survey. The cross-field rules
 * — a default that agrees with `dataType`, `locked` only on ingested, computed limited to string or
 * number, the key's charset and the reserved-name refusal — are **not** restated. They live on
 * `ZEmbeddedData`, which the service runs over the whole prospective row, so this schema and the row
 * schema cannot drift into disagreeing about what a valid field is.
 */
export const ZCreateSharedEmbeddedDataInput = z
  .object({
    key: z.string(),
    name: z.string(),
    description: z.string().nullish(),
    source: ZEmbeddedDataSource,
    dataType: ZEmbeddedDataType.optional(),
    defaultValue: ZEmbeddedDataDefaultValue.optional(),
    locked: z.boolean().optional(),
  })
  .strict();

export type TCreateSharedEmbeddedDataInput = z.infer<typeof ZCreateSharedEmbeddedDataInput>;

/**
 * What a caller may change on a library field.
 *
 * `key` and `source` are absent because they are immutable, and not for symmetry: a survey stores a
 * field's value under a `storageKey` whose shape depends on the source (a cuid for computed, the URL
 * param name for ingested), so flipping either would point every linked survey at data it can no
 * longer address. `dataType` is editable but guarded — see `updateSharedEmbeddedData`.
 */
export const ZUpdateSharedEmbeddedDataInput = z
  .object({
    name: z.string().optional(),
    description: z.string().nullish(),
    dataType: ZEmbeddedDataType.optional(),
    defaultValue: ZEmbeddedDataDefaultValue.optional(),
    locked: z.boolean().optional(),
  })
  .strict();

export type TUpdateSharedEmbeddedDataInput = z.infer<typeof ZUpdateSharedEmbeddedDataInput>;

/** Promoting a local field only needs the library name it will be filed under. */
export const ZPromoteEmbeddedDataInput = z
  .object({
    key: z.string(),
    description: z.string().nullish(),
  })
  .strict();

export type TPromoteEmbeddedDataInput = z.infer<typeof ZPromoteEmbeddedDataInput>;

/**
 * What a library write answers with.
 *
 * The two refusals a caller has to *act* on travel in the success payload rather than as thrown
 * errors. `handleServerError` in the action client reduces every throw to `error.message`, a bare
 * string, so the surveys blocking a delete and the id of the row already holding a key would be lost
 * on the way out — and those are precisely what the refusal is for: naming the surveys instead of
 * sending the user to find them, and offering "use the library field" instead of asking for another
 * name. Everything else the service throws (a reserved key, a missing row) says all it has to say in
 * its message, so it stays a throw and reaches the caller as `serverError`.
 */
export type TSharedEmbeddedDataWriteResult =
  | { status: "ok"; field: TSharedEmbeddedData }
  /** `existingId` is only ever set by promote; a plain create has no replacement to offer. */
  | { status: "keyConflict"; existingId: string | null }
  | { status: "inUse"; message: string; usage: TEmbeddedDataUsageItem[] };

/**
 * A library key that is already taken in this workspace.
 *
 * Subclasses `InvalidInputError` rather than replacing it, so any handler that only knows the base
 * class still maps it to the same 400. `name` is deliberately left as the parent's: `isExpectedError`
 * matches on it, and a new name would start reporting a duplicate key to Sentry as a fault.
 *
 * `existingId` is the row already holding the key, and it is only ever populated on promote — the
 * editor offers "replace this field with the library one", which needs the library row's id. A plain
 * create has no such offer to make and passes null.
 */
export class EmbeddedDataKeyConflictError extends InvalidInputError {
  readonly existingId: string | null;

  constructor(existingId: string | null = null) {
    super("Embedded data key already exists");
    this.existingId = existingId;
  }
}

/**
 * A write refused because of the surveys that already link the field — a delete that would strip the
 * field from all of them, or a `dataType` change that would reinterpret responses they have already
 * collected.
 *
 * Carries the usage rather than just a count so the caller can name the surveys in the refusal
 * instead of sending the user to find them.
 */
export class EmbeddedDataInUseError extends OperationNotAllowedError {
  readonly usage: TEmbeddedDataUsageItem[];

  constructor(message: string, usage: TEmbeddedDataUsageItem[]) {
    super(message);
    this.usage = usage;
  }
}
