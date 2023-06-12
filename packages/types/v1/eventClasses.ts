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

export type TEventClassNoCodeConfig = z.infer<typeof ZEventClassNoCodeConfig>;

export const ZEventClass = z.object({
  id: z.string().cuid2(),
  name: z.string(),
  description: z.union([z.string(), z.null()]),
  noCodeConfig: z.union([ZEventClassNoCodeConfig, z.null()]),
  type: z.enum(["code", "noCode", "automatic"]),
});

export type TEventClass = z.infer<typeof ZEventClass>;
