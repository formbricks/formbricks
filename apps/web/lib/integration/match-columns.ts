/** Where one label's value goes: an existing column (its index), or a new column with this name. */
export type TColumnChoice = { existing: number } | { create: string };

/**
 * Plans the column each label is written to, for the integrations that match columns by name (Airtable
 * fields, Google Sheets headers).
 *
 * ENG-3682: `legacyLabels[i]` is `labels[i]` as it read before block elements were separated by a space
 * ("First lineSecond line"). Before the fix, every question went to the columns named by its legacy
 * label, a repeated label matched by occurrence. The plan keeps each question in the column it wrote to
 * before, and moves a question to its new label only where that name can't be mistaken for another's:
 *
 * - A question is ambiguous when one of its two names is also a name of a question with another
 *   headline: two headlines that now read alike (`<p>A</p><p>BC</p>` and `<p>AB</p><p>C</p>`), a plain
 *   headline that reads like another's new label, or one whose new label is another's legacy label. An
 *   ambiguous question keeps the pre-fix behaviour: it uses, and creates, columns named by its legacy
 *   label only, matched by occurrence. Legacy labels are what told these questions apart before.
 * - Every other question owns both of its names. It takes a column named by its new label, else by its
 *   legacy label; repeats of it take those columns in column order, since a column appended later
 *   belongs to a later repeat. A missing column is created with the new label.
 *
 * No name belongs to two of these groups, so a question never takes another's column, and a write
 * places every question where the previous write did.
 */
export const matchLabelsToColumns = (
  columns: readonly string[],
  labels: readonly string[],
  legacyLabels: readonly string[]
): TColumnChoice[] => {
  const columnsByName = new Map<string, number[]>();
  columns.forEach((name, index) => {
    columnsByName.set(name, [...(columnsByName.get(name) ?? []), index]);
  });
  const columnsNamed = (name: string): number[] => columnsByName.get(name) ?? [];

  const headlineOf = (index: number) => JSON.stringify([labels[index], legacyLabels[index]]);
  const namesOf = (index: number) => [...new Set([labels[index], legacyLabels[index]])];
  const headlinesByName = new Map<string, Set<string>>();
  labels.forEach((_, index) => {
    for (const name of namesOf(index)) {
      headlinesByName.set(name, (headlinesByName.get(name) ?? new Set()).add(headlineOf(index)));
    }
  });
  const isAmbiguous = (index: number) =>
    namesOf(index).some((name) => (headlinesByName.get(name)?.size ?? 0) > 1);

  // Questions that share their columns: ambiguous ones by legacy label, the others by headline.
  const groups = new Map<string, { candidates: number[]; createAs: string; members: number[] }>();
  labels.forEach((label, index) => {
    const legacyLabel = legacyLabels[index];
    const ambiguous = isAmbiguous(index);
    const key = ambiguous ? `legacy:${legacyLabel}` : `headline:${headlineOf(index)}`;
    const group = groups.get(key);
    if (group) {
      group.members.push(index);
    } else if (ambiguous) {
      groups.set(key, { candidates: columnsNamed(legacyLabel), createAs: legacyLabel, members: [index] });
    } else {
      groups.set(key, {
        candidates: namesOf(index).flatMap(columnsNamed),
        createAs: label,
        members: [index],
      });
    }
  });

  const choices: TColumnChoice[] = [];
  for (const { candidates, createAs, members } of groups.values()) {
    // A single question prefers its new-label column; repeats keep their columns in column order.
    const ordered = members.length > 1 ? [...candidates].sort((a, b) => a - b) : candidates;
    members.forEach((index, occurrence) => {
      const column = ordered[occurrence];
      choices[index] = column === undefined ? { create: createAs } : { existing: column };
    });
  }
  return choices;
};
