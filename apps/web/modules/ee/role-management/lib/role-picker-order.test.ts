import { describe, expect, test } from "vitest";
import { toRolePickerOrder } from "./role-picker-order";

describe("toRolePickerOrder", () => {
  test("lists the most access first, the same in the invite picker and the role dropdown (U19)", () => {
    expect(toRolePickerOrder(["dashboard_viewer", "member", "manager", "owner", "billing"])).toEqual([
      "billing",
      "owner",
      "manager",
      "member",
      "dashboard_viewer",
    ]);
    expect(toRolePickerOrder(["dashboard_viewer", "member"])).toEqual(["member", "dashboard_viewer"]);
  });

  test("has nothing to list for someone who may give no role", () => {
    expect(toRolePickerOrder([])).toEqual([]);
  });

  test("does not reorder the list it was given", () => {
    const roles = ["member", "owner"] as const;
    toRolePickerOrder(roles);
    expect(roles).toEqual(["member", "owner"]);
  });
});
