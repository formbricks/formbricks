import type { TCreativeElementStyle, TCreativeStyle } from "./types";

const NEUTRAL_ELEMENT: TCreativeElementStyle = {
  light: { backgroundColor: "#0f172a", textColor: "#ffffff", borderColor: null },
  dark: { backgroundColor: "#0f172a", textColor: "#ffffff", borderColor: null },
  desktop: { fontSize: 14, paddingX: 16, paddingY: 8 },
  phone: { fontSize: 14, paddingX: 16, paddingY: 8 },
  borderRadius: 8,
  fontWeight: 600,
};

/**
 * A neutral look (a dark tab with white text, 4.5:1 and above) for tests and for a preview that has no
 * computed style yet. Visitors never see it: the server computes every delivered creative's style from
 * the workspace Look & Feel (ENG-3998).
 */
export const DEFAULT_CREATIVE_STYLE: TCreativeStyle = {
  element: NEUTRAL_ELEMENT,
  button: null,
  pageFont: false,
  customCss: null,
};
