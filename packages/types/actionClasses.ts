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

const ZActionClassNoCodeConfigBase = z.object({
  type: z.enum(["click", "pageView", "exitIntent", "50PercentScroll"]),
  urlFilters: z.array(
    z.object({
      value: z.string().trim().min(1),
      rule: ZActionClassPageUrlRule,
    })
  ),
});

const ZActionClassNoCodeConfigClick = ZActionClassNoCodeConfigBase.extend({
  type: z.literal("click"),
  elementSelector: z
    .object({
      cssSelector: z.string().trim().optional(),
      innerHtml: z.string().trim().optional(),
    })
    .superRefine((data, ctx) => {
      if (!data.cssSelector && !data.innerHtml) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Either cssSelector or innerHtml must be provided`,
        });
      }
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
  name: z.string().trim().min(1),
  description: z.string().nullable(),
  type: ZActionClassType,
  key: z.string().trim().min(1).nullable(),
  noCodeConfig: ZActionClassNoCodeConfig.nullable(),
  environmentId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TActionClass = z.infer<typeof ZActionClass>;

const ZActionClassInputBase = z.object({
  name: z.string().trim().min(1),
  description: z.string().nullable(),
  environmentId: z.string(),
  type: ZActionClassType,
});

export const ZActionClassInputCode = ZActionClassInputBase.extend({
  type: z.literal("code"),
  key: z.string().trim().min(1).nullable(),
});

export type TActionClassInputCode = z.infer<typeof ZActionClassInputCode>;

const ZActionClassInputNoCode = ZActionClassInputBase.extend({
  type: z.literal("noCode"),
  noCodeConfig: ZActionClassNoCodeConfig.nullable(),
});

const ZActionClassInputAutomatic = ZActionClassInputBase.extend({
  type: z.literal("automatic"),
});

export const ZActionClassInput = z.union([
  ZActionClassInputCode,
  ZActionClassInputNoCode,
  ZActionClassInputAutomatic,
]);

export type TActionClassInput = z.infer<typeof ZActionClassInput>;
