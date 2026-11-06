import { describe, expect, test, vi } from "vitest";
import { OrganizationRole } from "@formbricks/database/prisma";
import * as constants from "@/lib/constants";
import { getRoles } from "./utils";

vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
}));

describe("getRoles", () => {
  test("never lists the Dashboard viewer, which this API cannot assign (C3)", () => {
    const result = getRoles();
    expect(result.ok && result.data.data).not.toContain("dashboard_viewer");
  });

  test("should return all roles except billing when not in Formbricks Cloud", () => {
    const result = getRoles();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.data).toEqual(
        Object.values(OrganizationRole).filter((role) => role !== "billing" && role !== "dashboard_viewer")
      );
    }
  });

  test("should return all roles including billing when in Formbricks Cloud", () => {
    const originalValue = constants.IS_FORMBRICKS_CLOUD;
    Object.defineProperty(constants, "IS_FORMBRICKS_CLOUD", { value: true });
    const result = getRoles();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.data).toEqual(
        Object.values(OrganizationRole).filter((role) => role !== "dashboard_viewer")
      );
    }
    Object.defineProperty(constants, "IS_FORMBRICKS_CLOUD", { value: originalValue });
  });
});
