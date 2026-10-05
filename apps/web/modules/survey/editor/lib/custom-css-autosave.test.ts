import { describe, expect, test } from "vitest";
import type { TCustomCssValidationStatus } from "@/modules/custom-css/components/lib/validation";
import { getSurveyToAutosave, isCustomCssBlockingManualSave } from "./custom-css-autosave";

const saved = { name: "Saved", customCss: { light: { source: ".saved{}", compiled: "x" } } };
const working = { name: "Edited", customCss: { light: { source: ".draft{}", compiled: "" } } };

describe("getSurveyToAutosave", () => {
  test.each<TCustomCssValidationStatus>(["valid", "empty"])(
    "a %s draft autosaves with the working copy as is",
    (status) => {
      expect(getSurveyToAutosave(working, saved, status)).toBe(working);
    }
  );

  test.each<TCustomCssValidationStatus>(["pending", "invalid", "unavailable"])(
    "a %s draft is replaced by the saved CSS, and the other edits still go out",
    (status) => {
      expect(getSurveyToAutosave(working, saved, status)).toEqual({
        name: "Edited",
        customCss: saved.customCss,
      });
    }
  );

  test("the substitute leaves nothing to autosave when only the CSS draft changed", () => {
    const onlyCssChanged = { ...saved, customCss: working.customCss };
    expect(getSurveyToAutosave(onlyCssChanged, saved, "pending")).toEqual(saved);
  });
});

describe("isCustomCssBlockingManualSave", () => {
  test.each<[TCustomCssValidationStatus, boolean]>([
    ["invalid", true],
    ["pending", false],
    ["unavailable", false],
    ["valid", false],
    ["empty", false],
  ])("%s → %s", (status, blocks) => {
    expect(isCustomCssBlockingManualSave(status)).toBe(blocks);
  });
});
