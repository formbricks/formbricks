import { z } from "zod";
import { ZId } from "./common";

export const ZActionClassMatchType = z.union([
  z.literal("exactMatch"),
  z.literal("contains"),
  z.literal("startsWith"),
  z.literal("endsWith"),
  z.literal("notMatch"),
  z.literal("notContains"),
]);

// Define the rule values as a const array to avoid duplication
export const ACTION_CLASS_PAGE_URL_RULES = [
  "exactMatch",
  "contains",
  "startsWith",
  "endsWith",
  "notMatch",
  "notContains",
  "matchesRegex",
] as const;

// Create Zod schema from the const array
export const ZActionClassPageUrlRule = z.enum(ACTION_CLASS_PAGE_URL_RULES);

export type TActionClassPageUrlRule = z.infer<typeof ZActionClassPageUrlRule>;

const ZActionClassNoCodeConfigBase = z.object({
  type: z.enum(["click", "pageView", "exitIntent", "fiftyPercentScroll"]),
  urlFilters: z.array(
    z.object({
      value: z.string().trim().min(1, { message: "Value must contain atleast 1 character" }),
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

const ZActionClassNoCodeConfigfiftyPercentScroll = ZActionClassNoCodeConfigBase.extend({
  type: z.literal("fiftyPercentScroll"),
});

export const ZActionClassNoCodeConfig = z.union([
  ZActionClassNoCodeConfigClick,
  ZActionClassNoCodeConfigPageView,
  ZActionClassNoCodeConfigExitIntent,
  ZActionClassNoCodeConfigfiftyPercentScroll,
]);

export type TActionClassNoCodeConfig = z.infer<typeof ZActionClassNoCodeConfig>;

export const ZActionClassType = z.enum(["code", "noCode"]);

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
  name: z
    .string({ message: "Name is required" })
    .trim()
    .min(1, { message: "Name must be at least 1 character long" }),
  description: z.string().nullish(),
  environmentId: ZId.min(1, { message: "Environment ID cannot be empty" }),
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

export const ZActionClassInput = z.discriminatedUnion("type", [
  ZActionClassInputCode,
  ZActionClassInputNoCode,
]);

export type TActionClassInput = z.infer<typeof ZActionClassInput>;
