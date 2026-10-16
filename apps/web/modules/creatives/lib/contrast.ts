import type { TCreativeColors, TCreativeStyle } from "@formbricks/creatives";
import { AA_CONTRAST_RATIO, getContrastRatio } from "@formbricks/types/colors";

export type TContrastAppearance = "light" | "dark";

/** Text on background below WCAG AA, in the appearances that show the same colours. */
export interface TCreativeContrastWarning {
  appearances: TContrastAppearance[];
  /** Rounded down to one decimal, so a failing ratio never reads as the 4.5 it misses. */
  ratio: number;
}

const floorToTenth = (ratio: number): number => Math.floor(ratio * 10) / 10;

const isSamePair = (a: TCreativeColors, b: TCreativeColors): boolean =>
  a.backgroundColor === b.backgroundColor && a.textColor === b.textColor;

/**
 * The Styling tab's contrast warning (Section 508, CMS's VPAT): the creative's own text on its own
 * background, the feedback button or the banner's bar, in each appearance a visitor can get. The
 * banner's button is left out: it always looks like the survey button, which the Look & Feel owns.
 * Colours both appearances share (a custom pair is kept in dark) give a single warning.
 */
export const getCreativeContrastWarnings = (style: TCreativeStyle): TCreativeContrastWarning[] => {
  const { light, dark } = style.element;
  const ratioOf = (colors: TCreativeColors) => getContrastRatio(colors.textColor, colors.backgroundColor);
  const lightRatio = ratioOf(light);
  const darkRatio = ratioOf(dark);
  const lightFails = lightRatio < AA_CONTRAST_RATIO;
  const darkFails = darkRatio < AA_CONTRAST_RATIO;

  if (lightFails && darkFails && isSamePair(light, dark)) {
    return [{ appearances: ["light", "dark"], ratio: floorToTenth(lightRatio) }];
  }

  const warnings: TCreativeContrastWarning[] = [];
  if (lightFails) warnings.push({ appearances: ["light"], ratio: floorToTenth(lightRatio) });
  if (darkFails) warnings.push({ appearances: ["dark"], ratio: floorToTenth(darkRatio) });
  return warnings;
};
