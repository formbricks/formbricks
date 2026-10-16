import type { TCreativeStyle } from "./types";

/**
 * The look every creative has until the server computes styles from the workspace Look & Feel and the
 * creative's custom styles (ENG-3998): a dark tab with white text, which passes 4.5:1 contrast.
 */
export const DEFAULT_CREATIVE_STYLE: TCreativeStyle = {
  backgroundColor: "#0f172a",
  textColor: "#ffffff",
  borderColor: null,
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  paddingX: 16,
  paddingY: 8,
};
