import { describe, expect, test } from "vitest";
import { getAIUnavailableAction } from "./availability";

describe("getAIUnavailableAction", () => {
  test("returns the organization settings action when AI is not enabled", () => {
    expect(getAIUnavailableAction("not_enabled", "workspace-1")).toEqual({
      href: "/organizations/workspace-1/settings/general",
      type: "enable_ai",
    });
  });

  test("returns the billing action when AI is not in the plan", () => {
    expect(getAIUnavailableAction("not_in_plan", "workspace-1")).toEqual({
      href: "/organizations/workspace-1/settings/billing",
      type: "upgrade_plan",
    });
  });

  test("does not return an action when the instance is not configured", () => {
    expect(getAIUnavailableAction("instance_not_configured", "workspace-1")).toBeUndefined();
  });

  test("does not return an action for read-only users", () => {
    expect(getAIUnavailableAction("read_only", "workspace-1")).toBeUndefined();
  });

  test("does not return an action when the reason is unavailable", () => {
    expect(getAIUnavailableAction(undefined, "workspace-1")).toBeUndefined();
  });
});
