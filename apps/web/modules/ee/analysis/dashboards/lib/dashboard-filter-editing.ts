/** Filter labels as one phrase in the app's language ("Plan, Tier, and Region"). */
export const formatFilterLabels = (labels: readonly string[], locale: string): string =>
  new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(labels);
