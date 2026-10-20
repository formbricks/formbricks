import type { TCreativeStyle } from "@formbricks/creatives";
import { AA_CONTRAST_RATIO, getContrastRatio } from "@formbricks/types/colors";
import type { TStylingAppearance } from "@/lib/styling/dark-mode";

/** Text on background below WCAG AA in one appearance. */
export interface TCreativeContrastWarning {
  appearance: TStylingAppearance;
  /** Rounded down to one decimal, so a failing ratio never reads as the 4.5 it misses. */
  ratio: number;
}

const floorToTenth = (ratio: number): number => Math.floor(ratio * 10) / 10;

/**
 * The Styling tab's contrast warning (Section 508, CMS's VPAT): the creative's own text on its own
 * background, the feedback button or the banner's bar, in the appearance being edited, as the survey's
 * dark contrast warnings check the palette on screen. The banner's button is left out: it always looks
 * like the survey button, which the Look & Feel owns.
 */
export const getCreativeContrastWarning = (
  style: TCreativeStyle,
  appearance: TStylingAppearance
): TCreativeContrastWarning | null => {
  const { textColor, backgroundColor } = style.element[appearance];
  const ratio = getContrastRatio(textColor, backgroundColor);
  return ratio < AA_CONTRAST_RATIO ? { appearance, ratio: floorToTenth(ratio) } : null;
};
