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
 * The set holds the labels emitted so far rather than the names seen so far. The two differ only in
 * the pathological case — a field literally named `Source (utm_source)` sitting alongside two named
 * `Source` — and tracking emitted labels is what keeps the output collision-free there too, which is
 * the property the export's header-keyed rows depend on.
 *
 * Order is the input's order: callers pass `getIngestedEmbeddedFields(survey)` (or the computed
 * counterpart), whose order is already the user-visible one.
 */
export const labelEmbeddedFields = (fields: readonly TLinkedEmbeddedField[]): TLabelledEmbeddedField[] => {
  const taken = new Set<string>();

  return fields.map(({ field, link }) => {
    const label = taken.has(field.name) ? `${field.name} (${link.storageKey})` : field.name;
    taken.add(label);
    return { field, link, label };
  });
};
