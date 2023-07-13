import z from "zod";

export const ZActionClassNoCodeConfig = z.object({
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

export type TActionClassNoCodeConfig = z.infer<typeof ZActionClassNoCodeConfig>;

export const ZActionClass = z.object({
  id: z.string().cuid2(),
  name: z.string(),
  description: z.string().nullable(),
  type: z.enum(["code", "noCode", "automatic"]),
  noCodeConfig: z.union([ZActionClassNoCodeConfig, z.null()]),
  environmentId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TActionClass = z.infer<typeof ZActionClass>;
