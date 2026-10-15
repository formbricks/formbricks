import { describe, expect, test } from "vitest";
import type { TShowConditionGroup } from "@formbricks/types/show-conditions";
import { normalizeTestUrl, testUrlAgainstShowConditions } from "./url-tester";

const conditions: TShowConditionGroup = {
  id: "root",
  connector: "and",
  conditions: [
    {
      id: "include",
      leftOperand: { type: "page", value: "currentUrl" },
      operator: "containsAnyOf",
      rightOperand: { type: "static", value: ["/plan-compare", "/drug-coverage"] },
    },
    {
      id: "exclude",
      leftOperand: { type: "page", value: "currentUrl" },
      operator: "containsNoneOf",
      rightOperand: { type: "static", value: ["/plan-compare/print"] },
    },
    {
      id: "email",
      leftOperand: { type: "page", value: "queryParam", meta: { key: "source" } },
      operator: "doesNotEqual",
      rightOperand: { type: "static", value: "email" },
    },
    {
      id: "time",
      leftOperand: { type: "visit", value: "timeOnSite" },
      operator: "isGreaterThanOrEqual",
      rightOperand: { type: "static", value: 120 },
    },
  ],
};

const outcome = (url: string) =>
  Object.fromEntries(testUrlAgainstShowConditions(conditions, url).map((r) => [r.condition.id, r.passed]));

describe("testUrlAgainstShowConditions", () => {
  test("checks every URL condition, ignoring case like the SDK", () => {
    expect(outcome("https://www.medicare.gov/PLAN-COMPARE/results")).toEqual({
      include: true,
      exclude: true,
      email: true,
    });
  });

  test("reports each condition that fails", () => {
    expect(outcome("https://www.medicare.gov/plan-compare/print?source=email")).toEqual({
      include: true,
      exclude: false,
      email: false,
    });
  });

  test("leaves out conditions a URL cannot answer, like time on site", () => {
    expect(outcome("https://www.medicare.gov/")).not.toHaveProperty("time");
  });

  test("adds the scheme a bare address is missing, so it reads like the URL the SDK sees", () => {
    expect(normalizeTestUrl("medicare.gov/plans")).toBe("https://medicare.gov/plans");
    expect(normalizeTestUrl(" http://localhost:3000/x ")).toBe("http://localhost:3000/x");
    expect(outcome("medicare.gov/drug-coverage?source=news")).toMatchObject({ include: true, email: true });
  });
});
