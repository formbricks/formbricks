/**
 * The page background a link survey sits on, when it is a plain colour. Image and animated backgrounds
 * are the respondent page's business and stay out of the preview; the value is checked as a hex colour
 * before it reaches a style attribute.
 */
const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export const getStageBackground = (styling: Record<string, unknown>): string | undefined => {
  const background = styling.background;
  if (typeof background !== "object" || background === null) return undefined;
  const { bgType, bg } = background as { bgType?: unknown; bg?: unknown };
  return bgType === "color" && typeof bg === "string" && HEX_COLOR.test(bg) ? bg : undefined;
};
