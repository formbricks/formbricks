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

const URL_LIKE_FILTER_RULES = new Set<TActionClassPageUrlRule>(["exactMatch", "startsWith", "notMatch"]);
const DOMAIN_HOSTNAME_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/;

const isValidAbsoluteUrlFilterValue = (value: string): boolean => {
  try {
    const parsedUrl = new URL(value);

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return false;
    }

    const isIPv6 = parsedUrl.hostname.startsWith("[") && parsedUrl.hostname.endsWith("]");
    const isIPv4 = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(parsedUrl.hostname);

    return (
      DOMAIN_HOSTNAME_REGEX.test(parsedUrl.hostname) || parsedUrl.hostname === "localhost" || isIPv6 || isIPv4
    );
  } catch {
    return false;
  }
};

export const isValidActionClassUrlFilterValue = (value: string, rule: TActionClassPageUrlRule): boolean => {
  if (!URL_LIKE_FILTER_RULES.has(rule)) {
    return true;
  }

  return value.startsWith("/") || isValidAbsoluteUrlFilterValue(value);
};

const ZActionClassUrlFilter = z
  .object({
    value: z.string().trim().min(1, {
      error: "Value must contain at least 1 character",
    }),
    rule: ZActionClassPageUrlRule,
  })
  .superRefine((data, ctx) => {
    if (!isValidActionClassUrlFilterValue(data.value, data.rule)) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "Please enter a valid URL (e.g., https://example.com)",
      });
    }
  });

const ZActionClassNoCodeConfigBase = z.object({
  type: z.enum(["click", "pageView", "exitIntent", "fiftyPercentScroll", "pageDwell"]),
  urlFilters: z.array(ZActionClassUrlFilter),
  urlFiltersConnector: z.enum(["or", "and"]).optional(),
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
          code: "custom",
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

const ZActionClassNoCodeConfigTimeOnPage = ZActionClassNoCodeConfigBase.extend({
  type: z.literal("pageDwell"),
  timeInSeconds: z.number().int().min(1).max(3600),
});

export const ZActionClassNoCodeConfig = z.union([
  ZActionClassNoCodeConfigClick,
  ZActionClassNoCodeConfigPageView,
  ZActionClassNoCodeConfigExitIntent,
  ZActionClassNoCodeConfigfiftyPercentScroll,
  ZActionClassNoCodeConfigTimeOnPage,
]);

export type TActionClassNoCodeConfig = z.infer<typeof ZActionClassNoCodeConfig>;

export const ZActionClassType = z.enum(["code", "noCode"]);

export type TActionClassType = z.infer<typeof ZActionClassType>;

export const ZActionClass = z.object({
  id: z.cuid2(),
  name: z.string().trim().min(1),
  description: z.string().nullable(),
  type: ZActionClassType,
  key: z.string().trim().min(1).nullable(),
  noCodeConfig: ZActionClassNoCodeConfig.nullable(),
  environmentId: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type TActionClass = z.infer<typeof ZActionClass>;

const ZActionClassInputBase = z.object({
  name: z
    .string({
      error: "Name is required",
    })
    .trim()
    .min(1, {
      error: "Name must be at least 1 character long",
    }),
  description: z.string().nullish(),
  environmentId: ZId.min(1, {
    error: "Environment ID cannot be empty",
  }),
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
