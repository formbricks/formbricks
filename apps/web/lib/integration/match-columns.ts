/**
 * Picks the existing column each label is written to, for the integrations that match columns by name
 * (Airtable fields, Google Sheets headers). Returns, per label, an index into `columns`, or `undefined`
 * when the label needs a new column.
 *
 * Each column takes one label, and columns are taken in order, so a repeated label is matched by
 * occurrence: the second "Name" goes to the second "Name" column.
 *
 * ENG-3682: `legacyLabels[i]` is `labels[i]` as it read before block elements were separated by a space
 * ("First lineSecond line"). A label with no column of its own falls back to a free column carrying its
 * legacy label, so an integration set up before the fix keeps filling the same column. Exact labels
 * claim their columns first, so the fallback never takes a column another question owns by its own
 * label (e.g. a plain "AB" question next to a `<p>A</p><p>B</p>` one).
 */
export const matchLabelsToColumns = (
  columns: readonly string[],
  labels: readonly string[],
  legacyLabels: readonly string[]
): (number | undefined)[] => {
  const freeColumnsByLabel = new Map<string, number[]>();
  columns.forEach((label, index) => {
    freeColumnsByLabel.set(label, [...(freeColumnsByLabel.get(label) ?? []), index]);
  });
  const takeFreeColumn = (label: string): number | undefined => freeColumnsByLabel.get(label)?.shift();

  const exactMatches = labels.map(takeFreeColumn);
  return exactMatches.map((column, index) => column ?? takeFreeColumn(legacyLabels[index]));
};
