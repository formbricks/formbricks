/**
 * What the Embedded Data card warns about, and what it stops to ask (ENG-1854).
 *
 * Two different kinds of guard, both pure, both here so the card stays a renderer:
 *
 * - **Warnings** are read off the rows a survey already has. Every one of them describes something
 *   the author cannot fix by renaming — the address a field's values are stored under is fixed once
 *   responses exist (Migration Spec §18) — so none of them blocks a save. They exist to explain a
 *   field that is quietly not behaving the way its name suggests.
 * - **The type-change question** is the one place the card interrupts, because retyping a field that
 *   already has responses changes how the collected values are read back.
 */
import { type TEmbeddedDataType } from "@formbricks/types/embedded-data";
import { type TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import { RESERVED_FIELD_NAMES } from "@formbricks/types/reserved-field-names";
import { isSafeIdentifier } from "@formbricks/types/safe-identifier";
import { declaredEmbeddedFieldName } from "@/modules/survey/editor/lib/embedded-fields";

/**
 * One thing worth telling the author about a row. Never a reason to refuse one.
 *
 * `unsafeAddress` and `reservedAddress` are independent, not a severity ladder: `utm-campaign` is an
 * illegal identifier that is not reserved, `country` is a legal identifier that is, and a row can
 * carry both. `clashingAddress` is the ENG-3121 pair — a computed and an ingested field that resolve
 * to the same name, which the legacy two-column world allowed because the two had separate
 * namespaces and the merged one no longer does.
 */
export type TEmbeddedFieldWarning =
  | "unsafeAddress"
  | "reservedAddress"
  | "clashingAddress"
  | "lockedWithoutDefault";

/** Addresses one row, the way the reconcile does. The card's React key and the warning map agree. */
export const embeddedFieldKey = ({ field, link }: TLinkedEmbeddedField): string =>
  `${field.source}-${link.storageKey}`;

/**
 * Every warning each row carries, keyed by `embeddedFieldKey`. A row with nothing to say is absent.
 *
 * **Checked against the declared name, not the raw `storageKey`.** For an ingested field the two are
 * the same string — its address *is* the URL parameter it is filled from. For a computed field the
 * storage key is a minted cuid, which is always a legal identifier and never worth warning about,
 * while the name recall and logic actually address it by can be anything a legacy `survey.variables`
 * entry was allowed to be (`LEGACY_VARIABLE_NAME_REGEX` has no leading-letter rule, so `1foo` is
 * stored out there). `declaredEmbeddedFieldName` is the one that resolves to the string each source
 * is addressed by, and it is what the server's guard compares too.
 *
 * A linked library field is checked all the same, and in practice never warns: `ZEmbeddedData`
 * refuses a reserved or malformed key at creation, so a shared row cannot carry a legacy address.
 */
export const embeddedFieldWarnings = (
  fields: TLinkedEmbeddedField[]
): Map<string, TEmbeddedFieldWarning[]> => {
  const declaredNames = fields.map(declaredEmbeddedFieldName);
  // The namespace is case-insensitive and so is the reserved list, but the identifier rule is not —
  // a mixed-case address is one of the things being warned about, so it is checked before folding.
  const normalizedNames = declaredNames.map((name) => name.toLowerCase());
  const warnings = new Map<string, TEmbeddedFieldWarning[]>();

  fields.forEach((entry, index) => {
    const normalizedName = normalizedNames[index];
    const rowWarnings: TEmbeddedFieldWarning[] = [];

    if (!isSafeIdentifier(declaredNames[index])) rowWarnings.push("unsafeAddress");
    if (RESERVED_FIELD_NAMES.has(normalizedName)) rowWarnings.push("reservedAddress");
    if (normalizedNames.some((other, otherIndex) => otherIndex !== index && other === normalizedName)) {
      rowWarnings.push("clashingAddress");
    }
    // A locked field ignores whatever the URL or the SDK passes in, so its default is the only value
    // it can ever hold. Without one it is permanently empty, and every reference to it resolves to
    // nothing.
    if (entry.field.locked && entry.field.defaultValue === null) rowWarnings.push("lockedWithoutDefault");

    if (rowWarnings.length > 0) warnings.set(embeddedFieldKey(entry), rowWarnings);
  });

  return warnings;
};

/**
 * Whether retyping a field has to be confirmed first.
 *
 * Stored values are never re-coerced — `coerceToEmbeddedDataType` runs at ingest — so the responses
 * a survey already holds keep the shape they were written in, and only new ones are read as the new
 * type. Nothing is destroyed, but filters and logic comparing the new type stop matching the old
 * values, which is what the author is being asked about.
 *
 * `storedDataType` is read from the **persisted** survey rather than the working copy, so retyping
 * and retyping back is not two questions, and a field the survey has never saved is not a question
 * at all: it has no responses under any type.
 */
export const needsTypeChangeConfirm = ({
  nextDataType,
  storedDataType,
  responseCount,
}: {
  nextDataType: TEmbeddedDataType;
  /** The type the field has as stored, or null when the survey has never saved this field. */
  storedDataType: TEmbeddedDataType | null;
  responseCount: number;
}): boolean => storedDataType !== null && nextDataType !== storedDataType && responseCount > 0;
