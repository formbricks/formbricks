import type { TLinkedEmbeddedField } from "./embedded-data-resolver";

/** A field paired with the text a reader should show for it. */
export interface TLabelledEmbeddedField extends TLinkedEmbeddedField {
  /**
   * What to display: `field.name`, or `Name (storageKey)` when an earlier field in the same list
   * already took that name.
   */
  label: string;
}

/**
 * **What an Embedded Data field is called on screen** (ENG-3233). Every surface that labels a field
 * — response table headers, the summary cards, export column headers, the response emails, the
 * integration mapping pickers — renders this and reads values by `link.storageKey`. Names carry no
 * uniqueness constraint (only `storageKey` and `id` do), so a list of names alone is not always a
 * list a reader can tell apart, and an export addressing its columns by header would silently drop
 * one of two identically named fields.
 *
 * **Disambiguation is on collision only.** A name that nothing else in the list claims renders
 * bare; the noise of `Name (storage_key)` on every single field is exactly what this ticket removes,
 * so it is spent only where it buys something. The *first* claimant keeps the bare name and each
 * later one carries its key, which is what keeps a label stable when an unrelated second field is
 * added after it.
 *
 * The set holds the labels emitted so far rather than the names seen so far, and **the disambiguated
 * label is checked against it too**. Both halves are needed: a field literally named `Source (b)`
 * sitting ahead of two named `Source` collides on the *generated* label, not on any name, so
 * checking only `field.name` would emit `Source (b)` twice. Duplicate labels are exactly what the
 * export cannot survive — `getResponsesJson` keys its rows by label, so the later field would
 * overwrite the earlier one's value and the file would carry two identical headers.
 *
 * The numeric tail that settles such a collision is deliberately never reached by a name alone: it
 * needs a name *and* its key-qualified form both already taken.
 *
 * Order is the input's order: callers pass `getIngestedEmbeddedFields(survey)` (or the computed
 * counterpart), whose order is already the user-visible one.
 */
export const labelEmbeddedFields = (fields: readonly TLinkedEmbeddedField[]): TLabelledEmbeddedField[] => {
  const taken = new Set<string>();

  return fields.map(({ field, link }) => {
    const base = taken.has(field.name) ? `${field.name} (${link.storageKey})` : field.name;

    let label = base;
    for (let suffix = 2; taken.has(label); suffix++) label = `${base} (${suffix})`;

    taken.add(label);
    return { field, link, label };
  });
};
