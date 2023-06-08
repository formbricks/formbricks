import { z } from "zod";

export const ZEventClassNoCodeConfig = z.object({
  type: z.union([z.literal("innerHtml"), z.literal("pageUrl"), z.literal("cssSelector")]),
  pageUrl: z.optional(
    z.object({
      value: z.string(),
      rule: z.union([
        z.literal("exactMatch"),
        z.literal("contains"),
        z.literal("startsWith"),
        z.literal("endsWith"),
        z.literal("notMatch"),
        z.literal("notContains"),
      ]),
    })
  ),
  innerHtml: z.optional(z.object({ value: z.string() })),
  cssSelector: z.optional(z.object({ value: z.string() })),
});

export const ZEventClass = z.object({
  name: z.string(),
  description: z.string(),
  noCodeConfig: ZEventClassNoCodeConfig,
  type: z.string(),
});
