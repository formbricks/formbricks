import { createId } from "@paralleldrive/cuid2";
import { z } from "zod";
import {
  type TEmbeddedData,
  type TEmbeddedDataSource,
  type TEmbeddedDataType,
  ZEmbeddedDataSource,
  ZEmbeddedDataType,
} from "@formbricks/types/embedded-data";
import { type TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import {
  describeRowIssues,
  formatDefaultValueDraft,
  parseDefaultValueDraft,
} from "@/modules/embedded-data/settings/lib/library-field";

/**
 * One **local** Embedded Data field as the editor's card authors it.
 *
 * The same shape the workspace library dialog uses, minus the two columns only the library has: a
 * field a survey owns has no `key` (that is what makes it local) and no description. What is left is
 * every column a row carries, which is the point of the merged card — the Variables form could say
 * "text or number" and the Hidden Fields form could say nothing at all, so a typed, defaulted or
 * locked field was unauthorable in the editor before ENG-1851.
 */
export interface TEmbeddedFieldDraft {
  name: string;
  /**
   * The address the field's value lives under, which the author now writes rather than the form
   * deriving it from the name. Empty on a field that has never been saved and whose name the author
   * has not typed yet; read-only once the field exists, like the library's `key`.
   */
  storageKey: string;
  source: TEmbeddedDataSource;
  dataType: TEmbeddedDataType;
  /** Every control's value as the DOM holds it — a string, even where the stored column is not one. */
  defaultValue: string;
  locked: boolean;
}

/** The columns the card's form renders, and can therefore put a schema issue on. */
const DRAFT_COLUMNS: ReadonlySet<string> = new Set(["name", "source", "dataType", "defaultValue", "locked"]);

/**
 * Columns the form does not collect. Real cuid2s because `ZEmbeddedData` checks them as such; none
 * reaches the server, which mints its own — and `surveyId` is set with `key` null because that pair
 * is exactly what "owned by this survey" means.
 */
const CANDIDATE_COLUMNS = {
  id: createId(),
  workspaceId: createId(),
  surveyId: createId(),
  key: null,
  description: null,
} as const;

/** The draft as the row `ZEmbeddedData` should judge. */
export const toCandidateRow = (draft: TEmbeddedFieldDraft): TEmbeddedData => ({
  ...CANDIDATE_COLUMNS,
  createdAt: new Date(),
  updatedAt: new Date(),
  name: draft.name,
  source: draft.source,
  dataType: draft.dataType,
  defaultValue: parseDefaultValueDraft(draft.defaultValue, draft.dataType),
  locked: draft.locked,
});

/**
 * The draft's shape, with every actual rule delegated to `ZEmbeddedData` through
 * {@link describeRowIssues} — locking only an ingested field, a calculated field being text or
 * number, a default that agrees with its `dataType`, a name that is not blank.
 *
 * The name's *other* half — reserved spellings, the safe-identifier charset, duplicates — is not
 * here: it needs the survey the field is being added to, so it is `validateEmbeddedFieldName` and
 * runs at submit, where it can put a translated message on the same control.
 */
export const ZEmbeddedFieldDraft = z
  .object({
    name: z.string(),
    storageKey: z.string(),
    source: ZEmbeddedDataSource,
    dataType: ZEmbeddedDataType,
    defaultValue: z.string(),
    locked: z.boolean(),
  })
  .superRefine((draft, ctx) => {
    for (const issue of describeRowIssues(toCandidateRow(draft), DRAFT_COLUMNS)) {
      ctx.addIssue({ code: "custom", message: issue.message, path: issue.path });
    }
  });

/**
 * What the dialog opens with: an existing field's columns, or a new passed-in text field.
 *
 * `ingested` is the default because it is the common case — a value arriving from the URL or the
 * SDK — and because it is the one source that can be locked and given a default, so the form opens
 * with every control it has.
 */
export const toEmbeddedFieldDraft = (entry: TLinkedEmbeddedField | null): TEmbeddedFieldDraft => ({
  name: entry?.field.name ?? "",
  // A field the survey already has is shown at the address it is stored under. For one migrated from
  // a hidden field that is also its name, because the two were one string before this form separated
  // them — which is why the create form derives the address from the name rather than minting a cuid.
  storageKey: entry?.link.storageKey ?? "",
  source: entry?.field.source ?? "ingested",
  dataType: entry?.field.dataType ?? "string",
  defaultValue: formatDefaultValueDraft(entry?.field.defaultValue ?? null),
  locked: entry?.field.locked ?? false,
});

/**
 * The draft as the entry the survey holds.
 *
 * Always **local**: `key: null` is what says the survey owns the definition, and it is the only
 * ownership this dialog can declare — a shared field is linked through the library picker and edited
 * in the library. `id` is carried over when the field has one so the reconcile updates that row
 * rather than replacing it, and is absent on a field that has never been saved.
 */
export const toLocalEmbeddedField = (
  draft: TEmbeddedFieldDraft,
  { storageKey, id }: { storageKey: string; id?: string }
): TLinkedEmbeddedField => ({
  field: {
    ...(id === undefined ? {} : { id }),
    key: null,
    name: draft.name,
    source: draft.source,
    dataType: draft.dataType,
    defaultValue: parseDefaultValueDraft(draft.defaultValue, draft.dataType),
    locked: draft.locked,
  },
  link: { storageKey },
});
