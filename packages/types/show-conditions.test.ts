import { describe, expect, test } from "vitest";
import {
  SHOW_CONDITIONS_LIMITS,
  type TShowConditionGroup,
  type TShowConditionSingle,
  ZShowConditions,
  dropUnfinishedShowConditions,
  hasUnfinishedShowConditions,
} from "./show-conditions";

let idCounter = 0;
const nextId = (): string => `id${(++idCounter).toString()}`;

const condition = (
  type: string,
  operand: string,
  operator: string,
  value?: unknown,
  meta?: { key: string }
): TShowConditionSingle =>
  ({
    id: nextId(),
    leftOperand: { type, value: operand, ...(meta && { meta }) },
    operator,
    ...(value !== undefined && { rightOperand: { type: "static", value } }),
  }) as TShowConditionSingle;

const group = (
  connector: "and" | "or",
  conditions: (TShowConditionSingle | TShowConditionGroup)[]
): TShowConditionGroup => ({ id: nextId(), connector, conditions });

const fragments = (count: number, prefix = "/page-"): string[] =>
  Array.from({ length: count }, (_, index) => `${prefix}${index.toString()}`);

const issueMessages = (input: unknown): string[] => {
  const result = ZShowConditions.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe("ZShowConditions", () => {
  test("accepts the CMS rule: 20 include fragments, 15 exclude fragments, 2 minutes or 3 pages", () => {
    const rule = group("and", [
      condition("page", "currentUrl", "containsAnyOf", fragments(20)),
      condition("page", "currentUrl", "containsNoneOf", fragments(15, "/skip-")),
      group("or", [
        condition("visit", "timeOnSite", "isGreaterThanOrEqual", 120),
        condition("visit", "pagesViewed", "isGreaterThanOrEqual", 3),
      ]),
    ]);

    expect(ZShowConditions.parse(rule)).toEqual(rule);
  });

  test("keeps null as null", () => {
    expect(ZShowConditions.parse(null)).toBeNull();
  });

  test("turns an empty top-level group into null", () => {
    expect(ZShowConditions.parse(group("and", []))).toBeNull();
  });

  test("drops nested groups that are empty, and returns null when nothing is left", () => {
    const kept = condition("device", "deviceType", "equals", "desktop");
    const parsed = ZShowConditions.parse(group("and", [kept, group("or", [])]));

    expect(parsed?.conditions).toEqual([kept]);
    expect(ZShowConditions.parse(group("and", [group("or", []), group("and", [])]))).toBeNull();
  });

  test("trims text values and list entries", () => {
    const parsed = ZShowConditions.parse(
      group("and", [
        condition("page", "currentUrl", "contains", "  /plans  "),
        condition("page", "currentUrl", "containsAnyOf", [" /a ", "/b "]),
      ])
    );

    expect(parsed?.conditions.map((item) => (item as TShowConditionSingle).rightOperand?.value)).toEqual([
      "/plans",
      ["/a", "/b"],
    ]);
  });

  test.each([
    ["page", "currentUrl", "equals", "https://example.com/"],
    ["page", "currentUrl", "doesNotEqual", "https://example.com/"],
    ["page", "currentUrl", "contains", "/plans"],
    ["page", "currentUrl", "doesNotContain", "/plans"],
    ["page", "currentUrl", "startsWith", "https://example.com"],
    ["page", "currentUrl", "endsWith", "/compare"],
    ["page", "currentUrl", "containsAnyOf", ["/a", "/b"]],
    ["page", "currentUrl", "containsNoneOf", ["/a", "/b"]],
    ["page", "currentUrl", "pathIsAnyOf", ["/a", "https://example.com/b"]],
    ["page", "currentUrl", "pathIsNoneOf", ["/a"]],
    ["page", "pageReferrer", "contains", "google"],
    ["page", "entryReferrer", "containsNoneOf", ["ads.example.com"]],
    ["page", "queryParam", "equals", "email", { key: "source" }],
    ["page", "queryParam", "doesNotEqual", "email", { key: "source" }],
    ["page", "queryParam", "isSet", undefined, { key: "source" }],
    ["page", "queryParam", "isNotSet", undefined, { key: "source" }],
    ["visit", "pagesViewed", "equals", 3],
    ["visit", "pagesViewed", "isGreaterThan", 2],
    ["visit", "uniquePagesViewed", "isLessThan", 5],
    ["visit", "timeOnSite", "isGreaterThanOrEqual", 120],
    ["visit", "timeOnSite", "isLessThanOrEqual", 0],
    ["visit", "visitedUrls", "includes", "/drug-coverage"],
    ["visit", "visitedUrls", "doesNotInclude", "/drug-coverage"],
    ["device", "deviceType", "equals", "tablet"],
    ["device", "browser", "doesNotEqual", "samsung"],
    ["device", "screenWidth", "isGreaterThanOrEqual", 1024],
  ])("accepts %s.%s %s %j", (type, operand, operator, value, meta?: { key: string }) => {
    expect(issueMessages(group("and", [condition(type, operand, operator, value, meta)]))).toEqual([]);
  });

  test.each([
    [
      "an operand under the wrong type",
      condition("visit", "currentUrl", "contains", "/x"),
      "is not a visit operand",
    ],
    [
      "a query parameter without a key",
      condition("page", "queryParam", "equals", "x"),
      "needs the parameter name",
    ],
    [
      "a query parameter with a blank key",
      condition("page", "queryParam", "equals", "x", { key: "  " }),
      "needs the parameter name",
    ],
    ["a text operator on a number", condition("visit", "pagesViewed", "contains", "3"), "is not allowed"],
    [
      "a list operator on a query parameter",
      condition("page", "queryParam", "containsAnyOf", ["x"], { key: "source" }),
      "is not allowed",
    ],
    [
      "a value on isSet",
      condition("page", "queryParam", "isSet", "email", { key: "source" }),
      '"isSet" takes no value',
    ],
    ["isNotSet on a URL", condition("page", "currentUrl", "isNotSet"), "is not allowed"],
    [
      "an exact path list on a referrer, whose pages are another site's",
      condition("page", "pageReferrer", "pathIsAnyOf", ["/"]),
      "is not allowed",
    ],
    ["text for an exact path list", condition("page", "currentUrl", "pathIsAnyOf", "/a"), "expected a list"],
    ["a blank exact path", condition("page", "currentUrl", "pathIsNoneOf", ["/a", " "]), "cannot be empty"],
    ["a missing value", condition("page", "currentUrl", "contains"), "a value is required"],
    ["text for a number", condition("visit", "timeOnSite", "isGreaterThan", "120"), "expected a number"],
    ["a negative number", condition("device", "screenWidth", "isLessThan", -1), "expected a number"],
    ["a number for text", condition("page", "currentUrl", "contains", 3), "expected a non-empty text"],
    ["an empty string", condition("page", "currentUrl", "contains", ""), "expected a non-empty text"],
    ["a blank string", condition("page", "currentUrl", "contains", "   "), "expected a non-empty text"],
    ["text for a list", condition("page", "currentUrl", "containsAnyOf", "/a"), "expected a list"],
    ["an empty list", condition("page", "currentUrl", "containsAnyOf", []), "expected a list"],
    ["a blank list entry", condition("page", "currentUrl", "containsNoneOf", ["/a", " "]), "cannot be empty"],
    [
      "a list over the limit",
      condition("page", "currentUrl", "containsAnyOf", fragments(SHOW_CONDITIONS_LIMITS.maxListEntries + 1)),
      "at most 200 entries",
    ],
    ["an unknown device type", condition("device", "deviceType", "equals", "mobile"), "expected one of"],
    ["an unknown browser", condition("device", "browser", "equals", "brave"), "expected one of"],
  ])("rejects %s", (_, invalidCondition, expectedMessage) => {
    const messages = issueMessages(group("and", [invalidCondition]));

    expect(messages).toEqual([expect.stringContaining(expectedMessage)]);
  });

  test("rejects regex, which is not offered in 6.2", () => {
    expect(issueMessages(group("and", [condition("page", "currentUrl", "matchesRegex", ".*")]))).not.toEqual(
      []
    );
  });

  test("allows 20 conditions and rejects 21", () => {
    const conditions = (count: number) =>
      Array.from({ length: count }, () => condition("visit", "pagesViewed", "isGreaterThan", 1));

    expect(issueMessages(group("and", conditions(SHOW_CONDITIONS_LIMITS.maxConditions)))).toEqual([]);
    expect(issueMessages(group("and", conditions(SHOW_CONDITIONS_LIMITS.maxConditions + 1)))).toEqual([
      "at most 20 conditions are allowed",
    ]);
  });

  test("allows one nested level and rejects a second", () => {
    const leaf = () => condition("device", "deviceType", "equals", "phone");

    expect(issueMessages(group("and", [group("or", [leaf()])]))).toEqual([]);
    expect(issueMessages(group("and", [group("or", [group("and", [leaf()])])]))).toEqual([
      "groups can be nested at most 2 levels deep",
    ]);
  });

  test("rejects conditions longer than 10 KB once serialized", () => {
    const longFragments = fragments(SHOW_CONDITIONS_LIMITS.maxListEntries, `/${"x".repeat(60)}-`);

    expect(
      issueMessages(group("and", [condition("page", "currentUrl", "containsAnyOf", longFragments)]))
    ).toEqual(["conditions can be at most 10240 characters"]);
  });

  test("caps unique pages viewed at the 200 different pages the visit store remembers", () => {
    expect(
      issueMessages(group("and", [condition("visit", "uniquePagesViewed", "isGreaterThanOrEqual", 200)]))
    ).toEqual([]);
    expect(
      issueMessages(group("and", [condition("visit", "uniquePagesViewed", "isGreaterThanOrEqual", 201)]))
    ).toEqual(["expected a number from 0 to 200"]);
  });
});

describe("hasUnfinishedShowConditions", () => {
  const finished = condition("visit", "timeOnSite", "isGreaterThanOrEqual", 30);
  const unfinished = condition("page", "currentUrl", "pathIsAnyOf");

  test.each([
    ["no conditions", null, false],
    ["only finished rows", group("and", [finished]), false],
    ["an unfinished row next to a finished one", group("and", [finished, unfinished]), true],
    ["a lone unfinished row", group("and", [unfinished]), true],
    ["an unfinished row in a nested group", group("and", [finished, group("or", [unfinished])]), true],
    ["a group with no conditions list", { connector: "and" }, true],
  ])("%s → %s", (_label, value, expected) => {
    expect(hasUnfinishedShowConditions(value)).toBe(expected);
  });
});

describe("dropUnfinishedShowConditions", () => {
  test("keeps finished conditions and drops a row that has no value yet", () => {
    const finished = condition("page", "currentUrl", "pathIsAnyOf", ["/pricing"]);
    const unfinished = condition("page", "currentUrl", "pathIsAnyOf");
    const root = group("and", [finished, unfinished]);

    expect(dropUnfinishedShowConditions(root)).toEqual({ ...root, conditions: [finished] });
  });

  test("drops a group left empty, and returns null when nothing is finished", () => {
    const blank = condition("visit", "pagesViewed", "isGreaterThanOrEqual");
    const finished = condition("visit", "timeOnSite", "isGreaterThanOrEqual", 30);
    const root = group("and", [finished, group("or", [blank])]);

    expect(dropUnfinishedShowConditions(root)).toEqual({ ...root, conditions: [finished] });
    expect(dropUnfinishedShowConditions(group("and", [blank]))).toBeNull();
  });

  test("returns null for anything that is not a group of conditions", () => {
    expect(dropUnfinishedShowConditions(null)).toBeNull();
    expect(dropUnfinishedShowConditions("conditions")).toBeNull();
    expect(dropUnfinishedShowConditions({ id: "root", connector: "and" })).toBeNull();
  });

  test("leaves the limits to the strict schema, so an over-limit draft is not silently emptied", () => {
    const tooMany = group(
      "and",
      Array.from({ length: SHOW_CONDITIONS_LIMITS.maxConditions + 1 }, () =>
        condition("visit", "timeOnSite", "isGreaterThanOrEqual", 30)
      )
    );

    expect(dropUnfinishedShowConditions(tooMany)?.conditions).toHaveLength(
      SHOW_CONDITIONS_LIMITS.maxConditions + 1
    );
  });
});
