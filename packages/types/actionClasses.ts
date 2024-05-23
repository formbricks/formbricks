import z from "zod";

export const ZActionClassMatchType = z.union([
  z.literal("exactMatch"),
  z.literal("contains"),
  z.literal("startsWith"),
  z.literal("endsWith"),
  z.literal("notMatch"),
  z.literal("notContains"),
]);

export const ZActionClassPageUrlRule = z.union([
  z.literal("exactMatch"),
  z.literal("contains"),
  z.literal("startsWith"),
  z.literal("endsWith"),
  z.literal("notMatch"),
  z.literal("notContains"),
]);

export type TActionClassPageUrlRule = z.infer<typeof ZActionClassPageUrlRule>;

// export const ZActionClassNoCodeConfig = z.object({
//   // The "type field has been made optional to allow for multiple selectors in one noCode action from now on
//   // Use the existence check of the fields to determine the types of the noCode action
//   type: z.optional(z.union([z.literal("innerHtml"), z.literal("pageUrl"), z.literal("cssSelector")])),
//   pageUrl: z.optional(
//     z.object({
//       value: z.string(),
//       rule: ZActionClassPageUrlRule,
//     })
//   ),
//   innerHtml: z.optional(z.object({ value: z.string() })),
//   cssSelector: z.optional(z.object({ value: z.string() })),
// });

const ZActionClassNoCodeConfigBase = z.object({
  type: z.enum(["click", "pageView", "exitIntent", "50PercentScroll"]),
  urlFilters: z
    .array(
      z.object({
        value: z.string(),
        rule: ZActionClassPageUrlRule,
      })
    )
    .optional(),
});

const ZActionClassNoCodeConfigClick = ZActionClassNoCodeConfigBase.extend({
  type: z.literal("click"),
  elementSelector: z
    .object({
      cssSelector: z.string().optional(),
      innerHtml: z.string().optional(),
    })
    .superRefine((data) => {
      if (!data.cssSelector && !data.innerHtml) {
        throw new Error("Either cssSelector or innerHtml must be provided");
      }
      return true;
    }),
});

const ZActionClassNoCodeConfigPageView = ZActionClassNoCodeConfigBase.extend({
  type: z.literal("pageView"),
});

const ZActionClassNoCodeConfigExitIntent = ZActionClassNoCodeConfigBase.extend({
  type: z.literal("exitIntent"),
});

const ZActionClassNoCodeConfig50PercentScroll = ZActionClassNoCodeConfigBase.extend({
  type: z.literal("50PercentScroll"),
});

export const ZActionClassNoCodeConfig = z.union([
  ZActionClassNoCodeConfigClick,
  ZActionClassNoCodeConfigPageView,
  ZActionClassNoCodeConfigExitIntent,
  ZActionClassNoCodeConfig50PercentScroll,
]);

export type TActionClassNoCodeConfig = z.infer<typeof ZActionClassNoCodeConfig>;

export const ZActionClassType = z.enum(["code", "noCode", "automatic"]);

export type TActionClassType = z.infer<typeof ZActionClassType>;

export const ZActionClass = z.object({
  id: z.string().cuid2(),
  name: z.string(),
  description: z.string().nullable(),
  type: ZActionClassType,
  key: z.string().nullable(),
  noCodeConfig: ZActionClassNoCodeConfig.nullable(),
  environmentId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TActionClass = z.infer<typeof ZActionClass>;

export const ZActionClassInput = z.object({
  id: z.string().optional(),
  environmentId: z.string(),
  name: z.string(),
  description: z.string().optional().nullable(),
  key: z.string().optional().nullable(),
  noCodeConfig: ZActionClassNoCodeConfig.nullish(),
  type: z.enum(["code", "noCode", "automatic"]),
});

export const ZActionClassAutomaticInput = z.object({
  name: z.string(),
  description: z.string().optional(),
  type: z.enum(["automatic"]),
});

export type TActionClassAutomaticInput = z.infer<typeof ZActionClassAutomaticInput>;

export type TActionClassInput = z.infer<typeof ZActionClassInput>;

// Define NoCodeConfig schema
export const ZNoCodeConfig = z.object({
  type: z.union([z.literal("innerHtml"), z.literal("pageUrl"), z.literal("cssSelector")]),
  pageUrl: z.optional(
    z.object({
      value: z.string(),
      rule: ZActionClassMatchType, // Assuming MatchType is a Zod schema, otherwise you'll need to convert it too.
    })
  ),
  innerHtml: z.optional(
    z.object({
      value: z.string(),
    })
  ),
  cssSelector: z.optional(
    z.object({
      value: z.string(),
    })
  ),
});

export type TNoCodeConfig = z.infer<typeof ZNoCodeConfig>;
