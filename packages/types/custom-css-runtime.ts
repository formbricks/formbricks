import { z } from "zod";
import { CUSTOM_CSS_PROCESSOR_VERSION, type TCustomCss } from "./custom-css";

export const ZRenderedCustomCss = z.object({ light: z.string().optional(), dark: z.string().optional() });
export type TRenderedCustomCss = z.infer<typeof ZRenderedCustomCss>;

/** Respondents receive accepted output only, never the editable customer source. */
export const getRenderedCustomCss = (css: TCustomCss | null | undefined): TRenderedCustomCss | undefined => {
  if (!css || css.processorVersion !== CUSTOM_CSS_PROCESSOR_VERSION) return undefined;
  return { light: css.light?.compiled, dark: css.dark?.compiled };
};

/** Preserve the management shape where a public page still takes TSurvey, but never serialize source. */
export const stripCustomCssSource = (css: TCustomCss | null | undefined): TCustomCss | null => {
  if (!css || css.processorVersion !== CUSTOM_CSS_PROCESSOR_VERSION) return null;
  return {
    processorVersion: css.processorVersion,
    light: css.light ? { source: "", compiled: css.light.compiled } : null,
    dark: css.dark ? { source: "", compiled: css.dark.compiled } : null,
  };
};
