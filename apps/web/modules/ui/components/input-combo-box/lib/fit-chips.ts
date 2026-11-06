interface TChipSpacing {
  /** The space between two chips. */
  gap: number;
  /** The width the "+N" chip takes. */
  counterWidth: number;
}

/**
 * How many of a multi-select's chips show on its one line (jobenjada review #28): all of them when
 * they fit, else as many as fit next to a "+N" chip for the rest. The first always shows, cut short
 * when it alone is too wide. Before the box is measured (`available` 0) every chip shows.
 */
export const countChipsThatFit = (
  chipWidths: readonly number[],
  available: number,
  { gap, counterWidth }: TChipSpacing
): number => {
  if (chipWidths.length === 0) return 0;
  if (available <= 0) return chipWidths.length;

  const widthOf = (count: number) =>
    chipWidths.slice(0, count).reduce((sum, width) => sum + width, 0) + gap * Math.max(0, count - 1);

  if (widthOf(chipWidths.length) <= available) return chipWidths.length;

  let count = chipWidths.length - 1;
  while (count > 1 && widthOf(count) + gap + counterWidth > available) count -= 1;
  return Math.max(count, 1);
};
