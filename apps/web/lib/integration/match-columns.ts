/** Where one label's value goes: an existing column (its index), or a new column with this name. */
export type TColumnChoice = { existing: number } | { create: string };

/**
 * Plans the column each label is written to, for the integrations that match columns by name (Airtable
 * fields, Google Sheets headers). Each existing column takes at most one label, and a repeated label is
 * matched by occurrence: the second "Name" goes to the second "Name" column.
 *
 * ENG-3682: `legacyLabels[i]` is `labels[i]` as it read before block elements were separated by a space
 * ("First lineSecond line"). Where the two differ, the label has changed, and its question may already
 * own a column under the legacy label. The plan keeps every question in the column it wrote to before:
 *
 * 1. Unchanged labels claim their columns first, so a changed label's fallback never takes a column
 *    another question owns by its own label (a plain "A B" headline next to `<p>A</p><p>B</p>`).
 * 2. A changed label takes its new-label column, else its legacy-label column. When it repeats, its
 *    occurrences take those columns in column order: a column appended later belongs to a later
 *    occurrence, so each occurrence keeps its column from one write to the next.
 *    A new label that other questions share with a different legacy label (`<p>A</p><p>BC</p>` and
 *    `<p>AB</p><p>C</p>` both read "A B C", or a plain "A B C" headline) cannot say whose column a column
 *    of that name is, so those changed questions only use, and create, columns under their legacy label,
 *    which still tells them apart.
 * 3. A label left without a column gets a new one, named by its label unless another column already has
 *    that name; then by its legacy label, so two questions whose labels now coincide still get a column
 *    each, as they did before. Unchanged labels pick their names first.
 */
export const matchLabelsToColumns = (
  columns: readonly string[],
  labels: readonly string[],
  legacyLabels: readonly string[]
): TColumnChoice[] => {
  const freeColumnsByLabel = new Map<string, number[]>();
  columns.forEach((label, index) => {
    freeColumnsByLabel.set(label, [...(freeColumnsByLabel.get(label) ?? []), index]);
  });
  const freeColumns = (label: string): number[] => freeColumnsByLabel.get(label) ?? [];
  const claim = (label: string, column: number) => {
    freeColumnsByLabel.set(
      label,
      freeColumns(label).filter((free) => free !== column)
    );
  };

  const isChanged = (index: number) => legacyLabels[index] !== labels[index];
  const legacyLabelsByLabel = new Map<string, Set<string>>();
  labels.forEach((label, index) => {
    legacyLabelsByLabel.set(label, (legacyLabelsByLabel.get(label) ?? new Set()).add(legacyLabels[index]));
  });
  /** A changed label that other questions share with a different legacy label. */
  const isAmbiguous = (index: number) =>
    isChanged(index) && (legacyLabelsByLabel.get(labels[index])?.size ?? 0) > 1;
  const unchanged = labels.map((_, index) => index).filter((index) => !isChanged(index));
  const changed = labels.map((_, index) => index).filter(isChanged);
  const matched = new Map<number, number>();

  // 1) Unchanged labels, by occurrence.
  for (const index of unchanged) {
    const column = freeColumns(labels[index])[0];
    if (column === undefined) continue;
    claim(labels[index], column);
    matched.set(index, column);
  }

  // 2) Changed labels, each repeated label as one group.
  const groups = new Map<string, number[]>();
  for (const index of changed) {
    const key = JSON.stringify([labels[index], legacyLabels[index]]);
    groups.set(key, [...(groups.get(key) ?? []), index]);
  }
  for (const members of groups.values()) {
    const label = labels[members[0]];
    const legacyLabel = legacyLabels[members[0]];
    const candidates = isAmbiguous(members[0])
      ? [...freeColumns(legacyLabel)]
      : [...freeColumns(label), ...freeColumns(legacyLabel)];
    if (members.length > 1) candidates.sort((a, b) => a - b);
    members.forEach((index, occurrence) => {
      const column = candidates[occurrence];
      if (column === undefined) return;
      claim(columns[column], column);
      matched.set(index, column);
    });
  }

  // 3) New columns.
  const takenNames = new Set(columns);
  const created = new Map<number, string>();
  for (const index of [...unchanged, ...changed]) {
    if (matched.has(index)) continue;
    const name = isAmbiguous(index)
      ? legacyLabels[index]
      : ([labels[index], legacyLabels[index]].find((candidate) => !takenNames.has(candidate)) ??
        labels[index]);
    takenNames.add(name);
    created.set(index, name);
  }

  return labels.map((_, index) => {
    const column = matched.get(index);
    return column === undefined ? { create: created.get(index) ?? labels[index] } : { existing: column };
  });
};
