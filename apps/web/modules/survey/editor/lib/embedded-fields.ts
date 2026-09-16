/**
 * The editor's Embedded Data state, as rows (ENG-2628, ENG-1851).
 *
 * `localSurvey.embeddedFields` is what the Embedded Data card edits, and what every editor reader
 * resolves through — the legacy `variables` / `hiddenFields` columns are forwarded untouched from
 * mount state at the save boundary and re-derived server-side from these rows
 * (`toLegacyEmbeddedFields`). That is what removes the stale-projection problem the editor had while
 * the Variables and Hidden Fields cards owned the columns: there is one description of a survey's
 * fields in the working copy, so a reader can no longer disagree with the card that just changed it.
 *
 * Every function here is a pure list transform. The card holds the list on `localSurvey` and hands
 * it back through `setLocalSurvey`, so nothing in this module knows about React or about the survey.
 *
 * **Position is the order the author sees and the order that is stored.** A new field is appended,
 * an edited one keeps its place, and the reconcile writes `order` from this array's index — so the
 * card, the derived legacy columns and the stored rows all agree without anyone sorting anything.
 *
 * **Nothing here restates a validation rule.** Names go through `validateId`, cross-namespace
 * clashes through `validateNewDeclaredFields` — the same functions the server runs — and the row
 * rules (a default that agrees with `dataType`, locking only an ingested field, a computed field
 * being text or number) live on `ZEmbeddedData`, which the card's form parses against.
 */
import { createId } from "@paralleldrive/cuid2";
import { type TEmbeddedData, type TEmbeddedDataSource } from "@formbricks/types/embedded-data";
import { type TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import { validateNewDeclaredFields } from "@formbricks/types/surveys/declared-field-guard";
import { type TValidateIdError, validateId } from "@formbricks/types/surveys/validation";

/**
 * Addresses one field the way the reconcile does, on `(source, storageKey)`.
 *
 * A survey's storage keys are unique on their own (`@@unique([surveyId, storageKey])`), so for a
 * well-formed survey the source is redundant. It is matched anyway so that a survey which is not
 * cannot have a computed lookup answered by an ingested field, or the other way round.
 */
const isFieldAt =
  (source: TEmbeddedDataSource, storageKey: string) =>
  (entry: TLinkedEmbeddedField): boolean =>
    entry.field.source === source && entry.link.storageKey === storageKey;

/**
 * The address a field's value lives under inside the survey.
 *
 * One rule, two callers — a field the author declares here, and a library field they link — because
 * the address has to follow the *source* rather than where the field came from. An ingested field is
 * filled from `?name=`, so its address is its name; a computed field is addressed by the recall id
 * its tokens and logic operands already carry, so it gets a fresh cuid and its display name stays
 * free to be renamed.
 */
export const mintStorageKey = (source: TEmbeddedDataSource, name: string): string =>
  source === "computed" ? createId() : name;

/**
 * The library row slice the editor needs in order to link one.
 *
 * `key` is narrowed to a string because that is what makes a row shared; `TSharedEmbeddedDataListItem`
 * is assignable, so the picker hands its rows straight over.
 */
export type TLinkableSharedField = Pick<
  TEmbeddedData,
  "id" | "name" | "description" | "source" | "dataType" | "defaultValue" | "locked"
> & { key: string };

/**
 * One library row as the entry a survey links it with.
 *
 * The definition columns are copied rather than referenced: they are what the card renders and what
 * the legacy columns are derived from, and the reconcile ignores every one of them for a shared
 * entry — a shared definition is workspace-owned, so a survey can link it, reorder it and unlink it
 * but never write to it. `key` is what says the entry is shared, and `id` names the row.
 *
 * `storageKey` is passed in rather than minted here because the two callers mean different things by
 * it: linking a new library field mints one, while promoting a local field keeps the address the
 * survey's responses already use.
 */
export const toSharedEntry = (field: TLinkableSharedField, storageKey: string): TLinkedEmbeddedField => ({
  field: {
    id: field.id,
    key: field.key,
    name: field.name,
    source: field.source,
    dataType: field.dataType,
    defaultValue: field.defaultValue,
    locked: field.locked,
  },
  link: { storageKey },
});

/**
 * The list with one field created or updated at its address.
 *
 * A replace rather than a merge: unlike the variable form this succeeded, the card's dialog carries
 * every column a row has, and the two ownership moves — clone-to-edit and promote — are expressed by
 * handing this a differently-owned entry at the same address. `(source, storageKey)` still matches,
 * so both read as an edit in place and the field keeps its position.
 */
export const upsertEmbeddedField = (
  embeddedFields: readonly TLinkedEmbeddedField[],
  entry: TLinkedEmbeddedField
): TLinkedEmbeddedField[] => {
  const index = embeddedFields.findIndex(isFieldAt(entry.field.source, entry.link.storageKey));

  if (index === -1) return [...embeddedFields, entry];

  return embeddedFields.map((current, at) => (at === index ? entry : current));
};

/**
 * Clone-to-edit: the shared link at this address replaced by a local field copying what the library
 * row said.
 *
 * Nothing is written until Save. The reconcile reads the ownership switch off `key` becoming null
 * (ENG-3228) — `(storageKey, source, ownership)` is what identifies a field there — so this lands as
 * a swap rather than an edit, and the survey ends up owning a row of its own at the same storage key
 * while the library row is left alone.
 *
 * `id` goes with it: it names the workspace row, and carrying it on a local entry would be a lie
 * waiting to be dereferenced.
 */
export const cloneSharedFieldToLocal = (
  embeddedFields: readonly TLinkedEmbeddedField[],
  source: TEmbeddedDataSource,
  storageKey: string
): TLinkedEmbeddedField[] =>
  embeddedFields.map((entry) => {
    if (!isFieldAt(source, storageKey)(entry) || entry.field.key === null) return entry;

    const { id: _sharedRowId, ...definition } = entry.field;
    return { ...entry, field: { ...definition, key: null } };
  });

/**
 * Whether a field can be lifted into the library **right now**.
 *
 * Promote is a write on the row as the database holds it — it flips that row's ownership columns and
 * leaves the survey's link pointing at it — so the card can only offer it for a field whose stored
 * definition still says what is on screen. A field the survey has never saved has no row to promote
 * at all, which is the `id === undefined` case; a field edited since the last save would be filed
 * under the library key with its *old* name, type, default or lock, which is the comparison.
 *
 * A field that is already shared is not promotable for the obvious reason: it is already there.
 */
export const isPromotableEmbeddedField = (
  entry: TLinkedEmbeddedField,
  persistedFields: readonly TLinkedEmbeddedField[]
): boolean => {
  if (entry.field.key !== null || entry.field.id === undefined) return false;

  const stored = persistedFields.find(isFieldAt(entry.field.source, entry.link.storageKey));

  return (
    stored?.field.id === entry.field.id &&
    stored.field.name === entry.field.name &&
    stored.field.dataType === entry.field.dataType &&
    stored.field.defaultValue === entry.field.defaultValue &&
    stored.field.locked === entry.field.locked
  );
};

/** The list without the addressed field. A key that is not there is not an error — nothing to drop. */
export const removeEmbeddedField = (
  embeddedFields: readonly TLinkedEmbeddedField[],
  source: TEmbeddedDataSource,
  storageKey: string
): TLinkedEmbeddedField[] => embeddedFields.filter((entry) => !isFieldAt(source, storageKey)(entry));

/**
 * The name one entry occupies in the survey's recall and logic namespace.
 *
 * Mirrors `declaredEntryName` in the server's guard, and for the same reason: a computed field is
 * addressed by its name (a shared one by its library key, the spelling the derived legacy column
 * carries), an ingested field by the storage key its value arrives under.
 */
export const declaredEmbeddedFieldName = ({ field, link }: TLinkedEmbeddedField): string =>
  field.source === "computed" ? (field.key ?? field.name) : link.storageKey;

/**
 * Why a name the author typed cannot be used, or null when it can.
 *
 * Entirely delegated to `validateId` in its strict mode — the same call the server's
 * `validateNewDeclaredFieldNames` makes, so the inline error and a refused save agree about what a
 * new field may be called. The id lists are what turn a repeat into a duplicate: element ids, ending
 * card ids and every other field's declared name, because recall and logic address all four through
 * one namespace.
 *
 * **An unchanged name is left alone**, which is the editor's half of the server's grandfather rule:
 * a survey that already declares `country` must stay editable, or its author could no longer change
 * its type or its default.
 */
export const validateEmbeddedFieldName = ({
  name,
  takenIds,
  otherFieldNames,
  previousName,
}: {
  name: string;
  /** Ids already spoken for in the namespace: the survey's elements and ending cards. */
  takenIds: string[];
  /** Every field's declared name except the one being edited. */
  otherFieldNames: string[];
  /** The name the edited field already had, or null when the field is new. */
  previousName: string | null;
}): TValidateIdError | null => {
  if (previousName !== null && previousName.toLowerCase() === name.toLowerCase()) return null;

  return validateId(name, takenIds, [], otherFieldNames, [], { requireSafeIdentifier: true });
};

/**
 * The library rows this survey can still add, in library order.
 *
 * Three reasons one is not offered, and none of them is restated here:
 *
 * - it is **already linked** — matched on the row's id rather than its key, so a row renamed in the
 *   library still reads as the one the survey holds;
 * - its **address is taken** — `@@unique([surveyId, storageKey])` would refuse the link, and an
 *   ingested field's address is its library key, so a survey with a local `plan` cannot also link
 *   the library's `plan`;
 * - it would **clash across the namespaces** — `validateNewDeclaredFields` against the survey as
 *   stored, which is the same call, with the same grandfathering, the save itself would make.
 */
export const listLinkableSharedFields = ({
  library,
  embeddedFields,
  persistedFields,
}: {
  library: readonly TLinkableSharedField[];
  embeddedFields: readonly TLinkedEmbeddedField[];
  /** The survey's fields as stored — the baseline the server grandfathers names against. */
  persistedFields: readonly TLinkedEmbeddedField[];
}): TLinkableSharedField[] => {
  const linkedRowIds = new Set(
    embeddedFields.filter(({ field }) => field.key !== null).map(({ field }) => field.id)
  );
  const takenStorageKeys = new Set(embeddedFields.map(({ link }) => link.storageKey));

  return library.filter((row) => {
    if (linkedRowIds.has(row.id)) return false;

    const candidate = toSharedEntry(row, mintStorageKey(row.source, row.key));
    if (takenStorageKeys.has(candidate.link.storageKey)) return false;

    const errors = validateNewDeclaredFields({
      existing: { embeddedFields: [...persistedFields] },
      incoming: { embeddedFields: [...embeddedFields, candidate] },
    });
    const candidateName = declaredEmbeddedFieldName(candidate).toLowerCase();

    return !errors.some((error) => error.field.toLowerCase() === candidateName);
  });
};
