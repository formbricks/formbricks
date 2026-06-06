import { describe, expect, test } from "vitest";
import { isOnboardingPathname } from "./is-onboarding-pathname";

describe("isOnboardingPathname", () => {
  test("returns true for workspace onboarding routes", () => {
    expect(isOnboardingPathname("/organizations/org1/workspaces/new/survey")).toBe(true);
    expect(isOnboardingPathname("/organizations/org1/workspaces/new/templates")).toBe(true);
    expect(isOnboardingPathname("/organizations/org1/workspaces/new/ai")).toBe(true);
    expect(isOnboardingPathname("/organizations/org1/workspaces/new/plan")).toBe(true);
  });

  test("returns true for organization landing route", () => {
    expect(isOnboardingPathname("/organizations/org1/landing")).toBe(true);
  });

  test("returns false outside onboarding", () => {
    expect(isOnboardingPathname("/workspaces/ws1/surveys")).toBe(false);
    expect(isOnboardingPathname("/organizations/org1")).toBe(false);
  });
});
