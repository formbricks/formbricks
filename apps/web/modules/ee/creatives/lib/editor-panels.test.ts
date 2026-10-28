import { describe, expect, test } from "vitest";
import { DEFAULT_CREATIVE_STYLING } from "./creative";
import {
  CUSTOM_STYLE_PANELS,
  PUBLISH_ISSUE_PANELS,
  getInitialOpenPanels,
  getInvalidParamPanel,
  withPanelsOpen,
} from "./editor-panels";
import type { TCreativeStylingForm } from "./styling-form";

const button = (customStyles: boolean): TCreativeStylingForm => ({
  type: "feedbackButton",
  ...DEFAULT_CREATIVE_STYLING.feedbackButton,
  theme: { ...DEFAULT_CREATIVE_STYLING.feedbackButton.theme, customStyles },
});

describe("which panels are open", () => {
  test("on load only Colors opens, and only with custom styles on", () => {
    expect([...getInitialOpenPanels(button(true))]).toEqual(["colors"]);
    expect([...getInitialOpenPanels(button(false))]).toEqual([]);
  });

  test("opening and closing several at once leaves the others as they were", () => {
    const open = withPanelsOpen(new Set(["colors", "position"]), CUSTOM_STYLE_PANELS, false);
    expect([...open]).toEqual(["position"]);
    expect([...withPanelsOpen(open, ["schedule"], true)]).toEqual(["position", "schedule"]);
  });

  test("a flagged issue opens the folding panel that fixes it; Show on doesn't fold", () => {
    expect(PUBLISH_ISSUE_PANELS.condition_incomplete).toBe("showWhen");
    expect(PUBLISH_ISSUE_PANELS.end_before_start).toBe("schedule");
    expect(PUBLISH_ISSUE_PANELS.action_missing).toBeUndefined();
  });
});

describe("the panel for a field the server refused", () => {
  test.each([
    ["styling.position.desktop.offset", "position"],
    ["styling.theme.backgroundColor.dark", "colors"],
    ["styling.theme.borderColor", "colors"],
    ["styling.theme.customCss", "customCss"],
    ["styling.theme.fontSize.phone", "shapeAndSize"],
    ["styling.theme.borderRadius", "shapeAndSize"],
    ["styling.theme.pageFont", "shapeAndSize"],
    ["distribution.conditions.conditions[0].rightOperand", "showWhen"],
    ["distribution.displayPercentage", "showWhen"],
    ["schedule.endAt", "schedule"],
  ])("%s → %s", (name, panel) => {
    expect(getInvalidParamPanel(name)).toBe(panel);
  });

  test.each([
    "name",
    "content.label",
    "distribution.triggers",
    "styling.theme",
    "styling.theme.customStyles",
  ])("%s has no folding panel", (name) => {
    expect(getInvalidParamPanel(name)).toBeNull();
  });
});
