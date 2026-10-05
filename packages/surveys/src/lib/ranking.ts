interface TRankingOption {
  id: string;
  label: string;
}

interface TRankingSelection {
  /** Ranked option ids, in rank order */
  selectedIds: string[];
  /** Free text typed into the "Other" option; "" while it is ranked but empty */
  otherValue: string;
}

/**
 * Maps a stored ranking value to the option ids the ranking component works with.
 *
 * A ranking value is the localized labels in rank order. When "Other" is ranked, its slot holds the
 * respondent's own text instead of a label — the same convention as multiple choice — so an entry
 * that matches no other option resolves to "Other". Ids are accepted too, for values stored before
 * labels were used. Without an "Other" option, unmatched entries are dropped.
 */
export const rankingValueToSelection = (
  value: string[],
  options: TRankingOption[],
  otherOptionId?: string
): TRankingSelection => {
  const regularOptions = options.filter((option) => option.id !== otherOptionId);
  const otherId = options.some((option) => option.id === otherOptionId) ? otherOptionId : undefined;
  const selectedIds: string[] = [];
  let otherValue = "";

  for (const entry of value) {
    const match =
      regularOptions.find((option) => option.id === entry && !selectedIds.includes(option.id)) ??
      regularOptions.find((option) => option.label === entry && !selectedIds.includes(option.id));

    if (match) {
      selectedIds.push(match.id);
    } else if (otherId !== undefined && !selectedIds.includes(otherId)) {
      selectedIds.push(otherId);
      otherValue = entry;
    }
  }

  return { selectedIds, otherValue };
};

/**
 * Inverse of `rankingValueToSelection`: turns ranked option ids back into the stored value, with the
 * "Other" slot holding `otherValue`.
 */
export const selectionToRankingValue = (
  selectedIds: string[],
  options: TRankingOption[],
  otherOptionId: string | undefined,
  otherValue: string
): string[] => {
  const labels: string[] = [];

  for (const id of selectedIds) {
    if (otherOptionId !== undefined && id === otherOptionId) {
      labels.push(otherValue);
      continue;
    }
    const option = options.find((candidate) => candidate.id === id);
    if (option) labels.push(option.label);
  }

  return labels;
};
