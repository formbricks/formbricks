import { describe, expect, test } from "vitest";
import { getAIUnavailableAction, getAIUnavailableMessageKey } from "./ai-availability";

describe("ai availability helpers", () => {
  test("returns the not enabled message key and organization settings action", () => {
    expect(getAIUnavailableMessageKey("not_enabled")).toBe("workspace.analysis.charts.ai_not_enabled");
    expect(getAIUnavailableAction("not_enabled", "workspace-1")).toEqual({
      href: "/workspaces/workspace-1/settings/organization/general",
      labelKey: "workspace.analysis.charts.ai_enable_in_settings",
    });
  });

  test("returns the not in plan message key and billing action", () => {
    expect(getAIUnavailableMessageKey("not_in_plan")).toBe("workspace.analysis.charts.ai_not_in_plan");
    expect(getAIUnavailableAction("not_in_plan", "workspace-1")).toEqual({
      href: "/workspaces/workspace-1/settings/organization/billing",
      labelKey: "workspace.analysis.charts.ai_upgrade_plan",
    });
  });

  test("returns the instance not configured message key without an action", () => {
    expect(getAIUnavailableMessageKey("instance_not_configured")).toBe(
      "workspace.analysis.charts.ai_instance_not_configured"
    );
    expect(getAIUnavailableAction("instance_not_configured", "workspace-1")).toBeUndefined();
  });

  test("returns the generic fallback message key without an action", () => {
    expect(getAIUnavailableMessageKey()).toBe("workspace.analysis.charts.ai_not_available");
    expect(getAIUnavailableAction(undefined, "workspace-1")).toBeUndefined();
  });
});
