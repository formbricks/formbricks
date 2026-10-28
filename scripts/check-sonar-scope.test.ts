import { describe, expect, test } from "vitest";
import { findSonarScopeViolations, parseProperties } from "./check-sonar-scope.mjs";

const properties = (overrides: Record<string, string> = {}) =>
  parseProperties(
    Object.entries({
      "sonar.sources": "apps/web,packages/a",
      "sonar.tests": "apps/web,packages/a",
      "sonar.javascript.lcov.reportPaths": "apps/web/coverage/lcov.info,packages/a/coverage/lcov.info",
      "sonar.typescript.tsconfigPath": "apps/web/tsconfig.json,packages/a/tsconfig.json",
      ...overrides,
    })
      .map(([key, value]) => `${key}=${value}`)
      .join("\n")
  );

describe("findSonarScopeViolations", () => {
  test("passes when every coverage workspace is in all four lists", () => {
    expect(findSonarScopeViolations(["apps/web", "packages/a"], properties(), {})).toEqual([]);
  });

  test("names the list a new package is missing from", () => {
    const problems = findSonarScopeViolations(["apps/web", "packages/a", "packages/new"], properties(), {});
    expect(problems).toHaveLength(4);
    expect(problems.join("\n")).toContain("packages/new/coverage/lcov.info");
  });

  test("a package listed in sources but not in the lcov paths is reported", () => {
    const problems = findSonarScopeViolations(
      ["packages/a"],
      properties({ "sonar.javascript.lcov.reportPaths": "apps/web/coverage/lcov.info" }),
      {}
    );
    expect(problems).toEqual([
      "packages/a runs test:coverage but sonar.javascript.lcov.reportPaths does not list packages/a/coverage/lcov.info.",
    ]);
  });

  test("an out-of-scope package must stay out of the lists and carry a reason", () => {
    expect(
      findSonarScopeViolations(["apps/web", "packages/a"], properties(), { "packages/a": "build tooling" })
    ).toHaveLength(4);
    expect(findSonarScopeViolations(["apps/web"], properties(), { "packages/a": "x" })[0]).toContain(
      "has no test:coverage script"
    );
    expect(
      findSonarScopeViolations(["apps/web", "packages/b"], properties(), { "packages/b": " " })[0]
    ).toContain("without a reason");
  });
});
