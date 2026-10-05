import { z } from "zod";

export const CUSTOM_CSS_PROCESSOR_VERSION = 1;
export const CUSTOM_CSS_LIMITS = { workspace: 100 * 1024, survey: 20 * 1024 } as const;

const ZCustomCssMode = z.object({
  source: z.string().max(CUSTOM_CSS_LIMITS.workspace),
  // This is an output, never trusted on write. The server always processes source again.
  compiled: z.string().max(2 * 1024 * 1024),
});

export const ZCustomCss = z.object({
  light: ZCustomCssMode.nullable(),
  dark: ZCustomCssMode.nullable(),
  processorVersion: z.number().int().positive(),
});
export type TCustomCss = z.infer<typeof ZCustomCss>;
export type TCustomCssScope = keyof typeof CUSTOM_CSS_LIMITS;
export type TCustomCssRemoval = {
  appearance: "light" | "dark";
  message: string;
  line: number;
  column: number;
};
