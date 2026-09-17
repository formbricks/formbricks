const MIN_WIDTH_PERCENT = 50;
const WIDTH_RANGE_PERCENT = 41;
// Keeps the running hash a small integer, so the mixing below needs no 32-bit wraparound.
const HASH_MODULUS = 4099;

/**
 * A stable width between 50% and 90% for one skeleton row, derived from a `useId()` value.
 *
 * A column of skeleton rows should read as text of differing lengths rather than as identical
 * bars. That used to come from `Math.random()`, which is impure and gave the row a different width
 * on the server pass than on hydration; `useId()` is stable across both (ENG-2366).
 *
 * Multiply-and-mix rather than a plain sum of code points: consecutive `useId()` values differ by
 * a single character, so a sum would step the width by one percent at a time and the rows would
 * all look the same width. That is the property `spreads consecutive ids across the range` pins.
 */
export const getSkeletonWidthPercent = (id: string): number => {
  let hash = 0;
  for (const character of id) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) % HASH_MODULUS;
  }
  return (hash % WIDTH_RANGE_PERCENT) + MIN_WIDTH_PERCENT;
};
