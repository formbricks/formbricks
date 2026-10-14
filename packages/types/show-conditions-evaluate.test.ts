import { describe, expect, test } from "vitest";
import type { TShowConditionGroup, TShowConditionSingle } from "./show-conditions";
import { type TShowConditionsContext, evaluateShowConditions } from "./show-conditions-evaluate";

const context: TShowConditionsContext = {
  url: "https://www.medicare.gov/plan-compare/results?zip=10001&Source=Email",
  pageReferrer: "https://www.medicare.gov/",
  visit: {
    pagesViewed: 3,
    uniquePagesViewed: 2,
    timeOnSite: 125,
    entryReferrer: "https://www.google.com/",
    visitedUrls: ["/", "/plan-compare", "/drug-coverage"],
  },
  device: { deviceType: "desktop", browser: "chrome", screenWidth: 1280 },
};

let idCounter = 0;
const nextId = (): string => `id${(++idCounter).toString()}`;

const condition = (
  operand: string,
  operator: string,
  value?: unknown,
  meta?: { key: string }
): TShowConditionSingle =>
  ({
    id: nextId(),
    leftOperand: { type: "page", value: operand, ...(meta && { meta }) },
    operator,
    ...(value !== undefined && { rightOperand: { type: "static", value } }),
  }) as TShowConditionSingle;

const group = (
  connector: "and" | "or",
  conditions: (TShowConditionSingle | TShowConditionGroup)[]
): TShowConditionGroup => ({ id: nextId(), connector, conditions });

const passes = (single: TShowConditionSingle, ctx: TShowConditionsContext = context): boolean =>
  evaluateShowConditions(group("and", [single]), ctx).passed;

const source = { key: "source" };

describe("evaluateShowConditions", () => {
  test("passes with no conditions and reports nothing", () => {
    expect(evaluateShowConditions(null, context)).toEqual({ passed: true, results: [] });
  });

  test("passes an empty group, the same as no conditions", () => {
    expect(evaluateShowConditions(group("or", []), context)).toEqual({ passed: true, results: [] });
  });

  test.each([
    ["currentUrl", "equals", "HTTPS://WWW.MEDICARE.GOV/plan-compare/results?zip=10001&source=email", true],
    ["currentUrl", "equals", "https://www.medicare.gov/", false],
    ["currentUrl", "doesNotEqual", "https://www.medicare.gov/", true],
    ["currentUrl", "contains", "/PLAN-COMPARE", true],
    ["currentUrl", "doesNotContain", "/plan-compare", false],
    ["currentUrl", "startsWith", "https://www.medicare.gov", true],
    ["currentUrl", "endsWith", "source=email", true],
    ["currentUrl", "containsAnyOf", ["/nope", "/Plan-Compare"], true],
    ["currentUrl", "containsAnyOf", ["/nope", "/find-a-doctor"], false],
    ["currentUrl", "containsNoneOf", ["/nope", "/find-a-doctor"], true],
    ["currentUrl", "containsNoneOf", ["/nope", "/PLAN-compare"], false],
    ["pageReferrer", "contains", "medicare", true],
    ["entryReferrer", "contains", "google", true],
    ["entryReferrer", "containsNoneOf", ["google"], false],
  ])("text: %s %s %j → %s", (operand, operator, value, expected) => {
    expect(passes(condition(operand, operator, value))).toBe(expected);
  });

  test.each([
    ["equals", "email", source, true],
    ["doesNotEqual", "email", source, false],
    ["contains", "mai", source, true],
    ["doesNotContain", "mai", source, false],
    ["startsWith", "em", source, true],
    ["endsWith", "il", source, true],
    ["equals", "x", { key: "utm_campaign" }, false],
    ["doesNotEqual", "x", { key: "utm_campaign" }, true],
    ["isSet", undefined, source, true],
    ["isNotSet", undefined, source, false],
    ["isSet", undefined, { key: "utm_campaign" }, false],
    ["isNotSet", undefined, { key: "utm_campaign" }, true],
  ])("query parameter: %s %j with %j → %s", (operator, value, meta, expected) => {
    expect(passes(condition("queryParam", operator, value, meta))).toBe(expected);
  });

  test("query parameter: a repeated parameter matches when any of its values does", () => {
    const repeated = { ...context, url: "https://example.com/?tag=a&tag=b" };

    expect(passes(condition("queryParam", "equals", "b", { key: "tag" }), repeated)).toBe(true);
    expect(passes(condition("queryParam", "doesNotEqual", "a", { key: "tag" }), repeated)).toBe(false);
  });

  test("query parameter: an empty value still counts as set", () => {
    const empty = { ...context, url: "https://example.com/?source=" };

    expect(passes(condition("queryParam", "isSet", undefined, source), empty)).toBe(true);
    expect(passes(condition("queryParam", "isNotSet", undefined, source), empty)).toBe(false);
  });

  test("query parameter: an unparsable URL has no parameters", () => {
    const broken = { ...context, url: "not a url" };

    expect(passes(condition("queryParam", "equals", "x", source), broken)).toBe(false);
    expect(passes(condition("queryParam", "doesNotEqual", "x", source), broken)).toBe(true);
  });

  test.each([
    ["pagesViewed", "equals", 3, true],
    ["pagesViewed", "isGreaterThan", 3, false],
    ["pagesViewed", "isGreaterThanOrEqual", 3, true],
    ["pagesViewed", "isLessThan", 3, false],
    ["pagesViewed", "isLessThanOrEqual", 3, true],
    ["uniquePagesViewed", "isLessThan", 3, true],
    ["timeOnSite", "isGreaterThanOrEqual", 120, true],
    ["timeOnSite", "isGreaterThanOrEqual", 130, false],
    ["screenWidth", "isLessThan", 1024, false],
  ])("number: %s %s %d → %s", (operand, operator, value, expected) => {
    expect(passes(condition(operand, operator, value))).toBe(expected);
  });

  test.each([
    ["includes", "/drug", true],
    ["includes", "/find-a-doctor", false],
    ["doesNotInclude", "/find-a-doctor", true],
    ["doesNotInclude", "/DRUG-coverage", false],
  ])("visited URLs: %s %j → %s", (operator, value, expected) => {
    expect(passes(condition("visitedUrls", operator, value))).toBe(expected);
  });

  test.each([
    ["deviceType", "equals", "desktop", true],
    ["deviceType", "doesNotEqual", "desktop", false],
    ["browser", "equals", "chrome", true],
    ["browser", "doesNotEqual", "safari", true],
  ])("device: %s %s %j → %s", (operand, operator, value, expected) => {
    expect(passes(condition(operand, operator, value))).toBe(expected);
  });

  test("fails every visit condition when the visit is missing, but still evaluates page and device", () => {
    const visitConditions = [
      condition("pagesViewed", "isLessThan", 100),
      condition("timeOnSite", "isGreaterThanOrEqual", 0),
      condition("visitedUrls", "doesNotInclude", "/x"),
      condition("entryReferrer", "doesNotContain", "x"),
    ];
    const pageCondition = condition("currentUrl", "contains", "/plan-compare");
    const deviceCondition = condition("deviceType", "equals", "desktop");

    const evaluation = evaluateShowConditions(
      group("or", [...visitConditions, pageCondition, deviceCondition]),
      { ...context, visit: null }
    );

    expect(evaluation.passed).toBe(true);
    expect(evaluation.results).toEqual([
      ...visitConditions.map((single) => ({ conditionId: single.id, actual: null, passed: false })),
      { conditionId: pageCondition.id, actual: context.url, passed: true },
      { conditionId: deviceCondition.id, actual: "desktop", passed: true },
    ]);
  });

  test.each([
    ["a text operator on a number", condition("pagesViewed", "contains", "3")],
    ["a number operator on text", condition("currentUrl", "isGreaterThan", 3)],
    ["a list operator given text", condition("currentUrl", "containsAnyOf", "/plan-compare")],
    ["a text operator given a list", condition("currentUrl", "contains", ["/plan-compare"])],
    ["a missing value", condition("currentUrl", "contains")],
    ["an unknown operator", condition("currentUrl", "matchesRegex", ".*")],
    ["an unknown operand", condition("ipAddress", "equals", "1.2.3.4")],
  ])("fails closed on %s", (_, invalidCondition) => {
    expect(passes(invalidCondition)).toBe(false);
  });

  test("combines ALL, ANY and a nested group", () => {
    const onPlanPages = condition("currentUrl", "containsAnyOf", ["/plan-compare"]);
    const longVisit = condition("timeOnSite", "isGreaterThanOrEqual", 120);
    const manyPages = condition("pagesViewed", "isGreaterThanOrEqual", 5);
    const onPhone = condition("deviceType", "equals", "phone");

    expect(
      evaluateShowConditions(group("and", [onPlanPages, group("or", [longVisit, manyPages])]), context).passed
    ).toBe(true);
    expect(
      evaluateShowConditions(group("and", [onPlanPages, group("or", [manyPages, onPhone])]), context).passed
    ).toBe(false);
    expect(
      evaluateShowConditions(group("or", [onPhone, group("and", [onPlanPages, longVisit])]), context).passed
    ).toBe(true);
  });

  test("reports every condition in order, even after an ALL group has already failed", () => {
    const onPhone = condition("deviceType", "equals", "phone");
    const onPlanPages = condition("currentUrl", "contains", "/plan-compare");
    const visited = condition("visitedUrls", "includes", "/drug");

    const evaluation = evaluateShowConditions(
      group("and", [onPhone, group("or", [onPlanPages, visited])]),
      context
    );

    expect(evaluation).toEqual({
      passed: false,
      results: [
        { conditionId: onPhone.id, actual: "desktop", passed: false },
        { conditionId: onPlanPages.id, actual: context.url, passed: true },
        { conditionId: visited.id, actual: context.visit?.visitedUrls, passed: true },
      ],
    });
  });
});
