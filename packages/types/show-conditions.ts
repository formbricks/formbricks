import { z } from "zod";
import { ZId } from "./common";
import { MAX_UNIQUE_PAGES, isShowConditionGroup } from "./show-conditions-evaluate";

export const SHOW_CONDITION_DEVICE_TYPES = ["phone", "tablet", "desktop"] as const;
export type TShowConditionDeviceType = (typeof SHOW_CONDITION_DEVICE_TYPES)[number];

export const SHOW_CONDITION_BROWSERS = [
  "chrome",
  "safari",
  "firefox",
  "edge",
  "opera",
  "samsung",
  "other",
] as const;
export type TShowConditionBrowser = (typeof SHOW_CONDITION_BROWSERS)[number];

export const SHOW_CONDITION_OPERANDS = {
  page: ["currentUrl", "pageReferrer", "entryReferrer", "queryParam"],
  visit: ["pagesViewed", "uniquePagesViewed", "timeOnSite", "visitedUrls"],
  device: ["deviceType", "browser", "screenWidth"],
} as const;
export type TShowConditionOperandType = keyof typeof SHOW_CONDITION_OPERANDS;
export type TShowConditionOperand = (typeof SHOW_CONDITION_OPERANDS)[TShowConditionOperandType][number];

const TEXT_OPERATORS = [
  "equals",
  "doesNotEqual",
  "contains",
  "doesNotContain",
  "startsWith",
  "endsWith",
] as const;
const LIST_OPERATORS = ["containsAnyOf", "containsNoneOf"] as const;
/**
 * Pasted lists of exact page paths, for the current URL only: a line matches one page, not every page
 * whose URL contains it. Case, a trailing slash, the query string and the #hash are ignored.
 */
const PATH_LIST_OPERATORS = ["pathIsAnyOf", "pathIsNoneOf"] as const;
const NUMBER_OPERATORS = [
  "equals",
  "isGreaterThan",
  "isLessThan",
  "isGreaterThanOrEqual",
  "isLessThanOrEqual",
] as const;
const VISITED_URL_OPERATORS = ["includes", "doesNotInclude"] as const;
const ENUM_OPERATORS = ["equals", "doesNotEqual"] as const;
/** Whether the operand is there at all. These take no value. */
const PRESENCE_OPERATORS = ["isSet", "isNotSet"] as const;

/** Which operators each operand accepts. The editor builds its operator list from this too. */
export const SHOW_CONDITION_OPERATORS = {
  // Exact paths first: the editor offers operators in this order.
  currentUrl: [...PATH_LIST_OPERATORS, ...LIST_OPERATORS, ...TEXT_OPERATORS],
  pageReferrer: [...TEXT_OPERATORS, ...LIST_OPERATORS],
  entryReferrer: [...TEXT_OPERATORS, ...LIST_OPERATORS],
  queryParam: [...TEXT_OPERATORS, ...PRESENCE_OPERATORS],
  pagesViewed: NUMBER_OPERATORS,
  uniquePagesViewed: NUMBER_OPERATORS,
  timeOnSite: NUMBER_OPERATORS,
  visitedUrls: VISITED_URL_OPERATORS,
  deviceType: ENUM_OPERATORS,
  browser: ENUM_OPERATORS,
  screenWidth: NUMBER_OPERATORS,
} as const satisfies Record<TShowConditionOperand, readonly string[]>;
export type TShowConditionOperator = (typeof SHOW_CONDITION_OPERATORS)[TShowConditionOperand][number];

export const SHOW_CONDITIONS_LIMITS = {
  maxListEntries: 200,
  maxConditions: 20,
  maxDepth: 2,
  // Measured in characters of the JSON, which is also what localStorage stores (ENG-3878).
  maxSerializedLength: 10 * 1024,
} as const;

export interface TShowConditionSingle {
  id: string;
  leftOperand: {
    type: TShowConditionOperandType;
    value: TShowConditionOperand;
    /** `key` names the query parameter for the `queryParam` operand. */
    meta?: { key: string };
  };
  operator: TShowConditionOperator;
  rightOperand?: { type: "static"; value: string | number | string[] };
}

export interface TShowConditionGroup {
  id: string;
  connector: "and" | "or";
  conditions: (TShowConditionSingle | TShowConditionGroup)[];
}

/** `null` means "no conditions": the target always passes. */
export type TShowConditions = TShowConditionGroup | null;

/** One visit = one browser tab (ENG-3570). Built by the SDK's visit store (ENG-3872). */
export interface TVisitSnapshot {
  pagesViewed: number;
  uniquePagesViewed: number;
  /** Seconds. */
  timeOnSite: number;
  entryReferrer: string;
  /**
   * The journey, for the response and the debug panel: paths in the order seen, a reload collapsed,
   * the first page and the last 49 steps. Paths only, no query string.
   */
  visitedUrls: string[];
  /** Every different path of the visit, first seen first, up to `MAX_UNIQUE_PAGES`. Visited URL reads this. */
  uniquePaths: string[];
}

export interface TDeviceInfo {
  deviceType: TShowConditionDeviceType;
  browser: TShowConditionBrowser;
  /** The browser window's width in CSS pixels, not the physical screen's. */
  screenWidth: number;
}

const OPERAND_TYPE_BY_OPERAND = new Map<string, TShowConditionOperandType>(
  Object.entries(SHOW_CONDITION_OPERANDS).flatMap(([type, operands]) =>
    operands.map((operand) => [operand, type as TShowConditionOperandType] as const)
  )
);
const OPERATORS_BY_OPERAND = new Map<string, ReadonlySet<string>>(
  Object.entries(SHOW_CONDITION_OPERATORS).map(([operand, operators]) => [operand, new Set(operators)])
);
const LIST_OPERATOR_SET: ReadonlySet<string> = new Set([...LIST_OPERATORS, ...PATH_LIST_OPERATORS]);
const PRESENCE_OPERATOR_SET: ReadonlySet<string> = new Set(PRESENCE_OPERATORS);
const NUMBER_OPERANDS: ReadonlySet<string> = new Set([
  "pagesViewed",
  "uniquePagesViewed",
  "timeOnSite",
  "screenWidth",
]);
const ENUM_VALUES_BY_OPERAND = new Map<string, ReadonlySet<string>>([
  ["deviceType", new Set(SHOW_CONDITION_DEVICE_TYPES)],
  ["browser", new Set(SHOW_CONDITION_BROWSERS)],
]);

type TRightOperandValue = NonNullable<TShowConditionSingle["rightOperand"]>["value"];

const getListValueIssue = (value: TRightOperandValue): string | undefined => {
  if (!Array.isArray(value) || value.length === 0) return "expected a list with at least one entry";
  if (value.length > SHOW_CONDITIONS_LIMITS.maxListEntries) {
    return `a list can have at most ${SHOW_CONDITIONS_LIMITS.maxListEntries} entries`;
  }
  // An empty entry would match every URL, so a stray blank line must not slip through.
  if (value.includes("")) return "list entries cannot be empty";
  return undefined;
};

const getSingleValueIssue = (operand: string, value: TRightOperandValue): string | undefined => {
  if (operand === "uniquePagesViewed") {
    return typeof value === "number" && value >= 0 && value <= MAX_UNIQUE_PAGES
      ? undefined
      : `expected a number from 0 to ${MAX_UNIQUE_PAGES}`;
  }
  if (NUMBER_OPERANDS.has(operand)) {
    return typeof value === "number" && value >= 0 ? undefined : "expected a number of 0 or more";
  }

  const enumValues = ENUM_VALUES_BY_OPERAND.get(operand);
  if (enumValues) {
    return typeof value === "string" && enumValues.has(value)
      ? undefined
      : `expected one of: ${[...enumValues].join(", ")}`;
  }

  return typeof value === "string" && value !== "" ? undefined : "expected a non-empty text value";
};

/** Returns why the right operand doesn't fit the operand and operator, or `undefined` when it does. */
const getRightOperandIssue = (condition: TShowConditionSingle): string | undefined => {
  const { operator, rightOperand } = condition;

  if (PRESENCE_OPERATOR_SET.has(operator)) {
    return rightOperand === undefined ? undefined : `"${operator}" takes no value`;
  }
  if (rightOperand === undefined) return "a value is required";
  if (LIST_OPERATOR_SET.has(operator)) return getListValueIssue(rightOperand.value);
  return getSingleValueIssue(condition.leftOperand.value, rightOperand.value);
};

const refineCondition = (condition: TShowConditionSingle, ctx: z.RefinementCtx): void => {
  const { type, value: operand, meta } = condition.leftOperand;

  if (OPERAND_TYPE_BY_OPERAND.get(operand) !== type) {
    ctx.addIssue({
      code: "custom",
      message: `"${operand}" is not a ${type} operand`,
      path: ["leftOperand", "value"],
    });
    return;
  }

  if (operand === "queryParam" && !meta?.key) {
    ctx.addIssue({
      code: "custom",
      message: "a query parameter condition needs the parameter name in meta.key",
      path: ["leftOperand", "meta", "key"],
    });
  }

  if (!OPERATORS_BY_OPERAND.get(operand)?.has(condition.operator)) {
    ctx.addIssue({
      code: "custom",
      message: `operator "${condition.operator}" is not allowed for "${operand}"`,
      path: ["operator"],
    });
    return;
  }

  const rightOperandIssue = getRightOperandIssue(condition);
  if (rightOperandIssue) {
    ctx.addIssue({ code: "custom", message: rightOperandIssue, path: ["rightOperand", "value"] });
  }
};

const ZShowConditionSingle = z
  .object({
    id: ZId,
    leftOperand: z.object({
      type: z.enum(["page", "visit", "device"]),
      value: z.enum([
        ...SHOW_CONDITION_OPERANDS.page,
        ...SHOW_CONDITION_OPERANDS.visit,
        ...SHOW_CONDITION_OPERANDS.device,
      ]),
      meta: z.object({ key: z.string().trim() }).optional(),
    }),
    operator: z.enum([
      ...TEXT_OPERATORS,
      ...LIST_OPERATORS,
      ...PATH_LIST_OPERATORS,
      ...NUMBER_OPERATORS,
      ...VISITED_URL_OPERATORS,
      ...PRESENCE_OPERATORS,
    ]),
    rightOperand: z
      .object({
        type: z.literal("static"),
        value: z.union([z.string().trim(), z.number(), z.array(z.string().trim())]),
      })
      .optional(),
  })
  .superRefine(refineCondition);

export const ZShowConditionGroup: z.ZodType<TShowConditionGroup> = z.lazy(() =>
  z.object({
    id: ZId,
    connector: z.enum(["and", "or"]),
    conditions: z.array(z.union([ZShowConditionSingle, ZShowConditionGroup])),
  })
);

const countConditions = (group: TShowConditionGroup): number =>
  group.conditions.reduce(
    (count, item) => count + (isShowConditionGroup(item) ? countConditions(item) : 1),
    0
  );

const getDepth = (group: TShowConditionGroup): number =>
  1 + Math.max(0, ...group.conditions.filter(isShowConditionGroup).map(getDepth));

const refineLimits = (conditions: TShowConditions, ctx: z.RefinementCtx): void => {
  if (!conditions) return;
  const { maxConditions, maxDepth, maxSerializedLength } = SHOW_CONDITIONS_LIMITS;

  if (countConditions(conditions) > maxConditions) {
    ctx.addIssue({ code: "custom", message: `at most ${maxConditions} conditions are allowed` });
  }
  if (getDepth(conditions) > maxDepth) {
    ctx.addIssue({ code: "custom", message: `groups can be nested at most ${maxDepth} levels deep` });
  }
  if (JSON.stringify(conditions).length > maxSerializedLength) {
    ctx.addIssue({ code: "custom", message: `conditions can be at most ${maxSerializedLength} characters` });
  }
};

/**
 * Drops groups that end up with no conditions, and turns an empty top-level group into `null`.
 * An empty `or` group would otherwise evaluate to false and silently hide the target forever.
 */
const pruneEmptyGroups = (group: TShowConditionGroup): TShowConditionGroup | null => {
  const conditions = group.conditions.flatMap<TShowConditionSingle | TShowConditionGroup>((item) => {
    if (!isShowConditionGroup(item)) return [item];
    const pruned = pruneEmptyGroups(item);
    return pruned ? [pruned] : [];
  });
  return conditions.length > 0 ? { ...group, conditions } : null;
};

export const ZShowConditions = ZShowConditionGroup.nullable()
  .superRefine(refineLimits)
  .transform((conditions): TShowConditions => (conditions ? pruneEmptyGroups(conditions) : null));

const ZShowConditionGroupHeader = z.object({ id: ZId, connector: z.enum(["and", "or"]) });

const keepFinished = (item: unknown): TShowConditionSingle | TShowConditionGroup | null => {
  const single = ZShowConditionSingle.safeParse(item);
  if (single.success) return single.data;

  const header = ZShowConditionGroupHeader.safeParse(item);
  const children = (item as { conditions?: unknown } | null)?.conditions;
  if (!header.success || !Array.isArray(children)) return null;
  return { ...header.data, conditions: children.flatMap((child) => keepFinished(child) ?? []) };
};

/**
 * The finished part of stored conditions. A condition that is not filled in (or not readable) is
 * dropped, and so is any group left empty; it could never pass anyway. Draft saves store conditions
 * loosely on purpose, since autosave sends the row an author is still filling in, so a reader that
 * parses the stored copy strictly (the v3 API) reads it through this first. Limits are not checked:
 * a draft over them still gets a clear error rather than silently losing its conditions.
 */
export const dropUnfinishedShowConditions = (value: unknown): TShowConditions => {
  const kept = keepFinished(value);
  return kept && isShowConditionGroup(kept) ? pruneEmptyGroups(kept) : null;
};

/** Leaf conditions in a stored value, read loosely: anything that is not a group counts as one. */
const countStoredConditions = (value: unknown): number => {
  if (!value || typeof value !== "object") return 0;
  const children = (value as { conditions?: unknown }).conditions;
  if (!Array.isArray(children)) return 1;
  return children.reduce<number>((count, child) => count + countStoredConditions(child), 0);
};

/**
 * Whether stored conditions hold a row {@link dropUnfinishedShowConditions} would drop. Dropping a row
 * from an AND group widens who sees the target, and dropping the only row shows it to everyone, so a
 * writer that takes a survey live must refuse this rather than write the cleaned copy.
 */
export const hasUnfinishedShowConditions = (value: unknown): boolean => {
  const kept = dropUnfinishedShowConditions(value);
  return countStoredConditions(value) !== (kept ? countConditions(kept) : 0);
};
