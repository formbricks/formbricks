/**
 * Colors for the smiley rating scale.
 *
 * A face is drawn as `currentColor` line art (see `components/general/smileys.tsx`) on top of a
 * circle whose fill comes from here, so the fill and the ink that lands on it are two halves of one
 * decision and are returned together.
 *
 * Every fill the scale can paint — `yellow-200` for a selected face, the `*-100` / `*-300` pastels
 * for color coding — is a light color in *both* appearances. In dark mode the line art otherwise
 * inherits `--fb-input-text-color` (near-white on a dark survey), leaving eyes and mouth at ~1.1 : 1
 * against their own fill (ENG-3937). A filled face therefore pins a dark ink under the dark
 * appearance. Light mode keeps inheriting: the inherited color is already dark there, so nothing
 * about the light rendering changes.
 */

/**
 * The scale sizes the renderer offers. Declared here because the color mapping below is defined
 * per range; `RatingProps.range` reuses it so the two cannot drift apart.
 */
export type RatingRange = 3 | 4 | 5 | 6 | 7 | 10;

/**
 * Ink for line art that sits on a face fill — dark appearance only (see above).
 *
 * Kept as one complete literal: Tailwind finds classes by scanning source text, so splitting or
 * interpolating this would stop the utility being emitted with no test or build failing
 * (packages/survey-ui/scripts/assert-scoped-css.mjs guards the built stylesheet for exactly that).
 */
const FILLED_FACE_INK = "dark:text-slate-900";

/** No fill means the line art sits on the card itself, where the inherited color is correct. */
const UNFILLED_FACE_INK = "";

export interface SmileyColorClasses {
  /** Tailwind `fill-*` class for the face circle. */
  fill: string;
  /** Tailwind text color class driving `currentColor` for the line art; empty when the face has no fill. */
  ink: string;
}

/** Fill for an unselected face when color coding is on. */
const getSmileyColor = (range: RatingRange, idx: number): string => {
  if (range > 5) {
    if (range - idx < 3) return "fill-emerald-100";
    if (range - idx < 5) return "fill-orange-100";
    return "fill-rose-100";
  } else if (range < 5) {
    if (range - idx < 2) return "fill-emerald-100";
    if (range - idx < 3) return "fill-orange-100";
    return "fill-rose-100";
  }
  if (range - idx < 3) return "fill-emerald-100";
  if (range - idx < 4) return "fill-orange-100";
  return "fill-rose-100";
};

/** Fill for a selected or previewed face when color coding is on. */
const getActiveSmileyColor = (range: RatingRange, idx: number): string => {
  if (range > 5) {
    if (range - idx < 3) return "fill-emerald-300";
    if (range - idx < 5) return "fill-orange-300";
    return "fill-rose-300";
  } else if (range < 5) {
    if (range - idx < 2) return "fill-emerald-300";
    if (range - idx < 3) return "fill-orange-300";
    return "fill-rose-300";
  }
  if (range - idx < 3) return "fill-emerald-300";
  if (range - idx < 4) return "fill-orange-300";
  return "fill-rose-300";
};

/**
 * The fill of one face and the ink its line art is drawn with.
 *
 * @param range - Number of options on the scale
 * @param idx - Zero-based index of this face within the scale
 * @param active - Whether the face is selected or previewed
 * @param addColors - Whether color coding is enabled
 */
export const getSmileyColorClasses = (
  range: RatingRange,
  idx: number,
  active: boolean,
  addColors: boolean
): SmileyColorClasses => {
  if (addColors) {
    return {
      fill: active ? getActiveSmileyColor(range, idx) : getSmileyColor(range, idx),
      ink: FILLED_FACE_INK,
    };
  }
  return active
    ? { fill: "fill-yellow-200", ink: FILLED_FACE_INK }
    : { fill: "fill-none", ink: UNFILLED_FACE_INK };
};
