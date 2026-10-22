/**
 * The creative editor's phone preview: a real phone's screen in CSS px (an iPhone 14's 390 × 844), drawn
 * at that size and scaled down as a whole to fit the preview pane, so what a creative does on a phone
 * (its phone sizes, wrapping, placement) is what the author sees. The page starts below the status bar,
 * as a site in a phone browser does, so a top banner is never under the notch.
 */
export const PHONE_SCREEN = {
  width: 390,
  height: 844,
  statusBarHeight: 47,
  pageHeight: 844 - 47,
  cornerRadius: 47,
} as const;

/** The device around the screen: its bezel on every side. */
const BEZEL = 12;

export const PHONE_FRAME = {
  bezel: BEZEL,
  width: PHONE_SCREEN.width + 2 * BEZEL,
  height: PHONE_SCREEN.height + 2 * BEZEL,
  cornerRadius: PHONE_SCREEN.cornerRadius + BEZEL,
} as const;

/** How much to shrink the device so it fits `available` (CSS px); never above life size. */
export const getPhoneScale = (available: { width: number; height: number }): number => {
  const scale = Math.min(available.width / PHONE_FRAME.width, available.height / PHONE_FRAME.height, 1);
  return Math.max(scale, 0);
};
