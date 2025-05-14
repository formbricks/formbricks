import * as constants from "@/lib/constants";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TOrganizationBillingPlan } from "@formbricks/types/organizations";
import { getSurveyFollowUpsPermission } from "./utils";

vi.mock("@/lib/constants", async () => {
  const actual = (await vi.importActual("@/lib/constants")) as any;
  return {
    ...actual,
    IS_FORMBRICKS_CLOUD: true,
    PROJECT_FEATURE_KEYS: {
      FREE: "free",
    },
  };
});

describe("getSurveyFollowUpsPermission", () => {
  beforeEach(() => {
    vi.spyOn(constants, "IS_FORMBRICKS_CLOUD", "get").mockReturnValue(true);
  });

  test("should return false for free plan on Formbricks Cloud", async () => {
    const result = await getSurveyFollowUpsPermission("free" as TOrganizationBillingPlan);
    expect(result).toBe(false);
  });

  test("should return true for non-free plan on Formbricks Cloud", async () => {
    const result = await getSurveyFollowUpsPermission("startup" as TOrganizationBillingPlan);
    expect(result).toBe(true);
  });

  test("should return true for any plan when not on Formbricks Cloud", async () => {
    vi.spyOn(constants, "IS_FORMBRICKS_CLOUD", "get").mockReturnValue(false);
    const result = await getSurveyFollowUpsPermission("free" as TOrganizationBillingPlan);
    expect(result).toBe(true);
  });
});
