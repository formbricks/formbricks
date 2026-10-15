import { describe, expect, test } from "vitest";
import { getWebhookSurveyOptions, mergePickedSurveyIds } from "./survey-options";

const open = { id: "open", name: "Open survey", visibility: "workspace" as const };
const restricted = { id: "restricted", name: "Restricted survey", visibility: "restricted" as const };

describe("getWebhookSurveyOptions", () => {
  test("lists every survey as a selectable option while the gate is off", () => {
    expect(getWebhookSurveyOptions([open, restricted], false, "Restricted")).toEqual([
      { value: "open", label: "Open survey" },
      { value: "restricted", label: "Restricted survey" },
    ]);
  });

  test("disables and marks a restricted survey while the gate is on", () => {
    expect(getWebhookSurveyOptions([open, restricted], true, "Restricted")).toEqual([
      { value: "open", label: "Open survey" },
      { value: "restricted", label: "Restricted survey", description: "Restricted", disabled: true },
    ]);
  });

  test("keeps an already attached restricted survey selectable so it can be removed", () => {
    expect(getWebhookSurveyOptions([restricted], true, "Restricted", ["restricted"])).toEqual([
      { value: "restricted", label: "Restricted survey" },
    ]);
  });
});

describe("mergePickedSurveyIds", () => {
  test("replaces the listed surveys with the picked ones", () => {
    expect(mergePickedSurveyIds(["a", "b"], ["b", "c"], ["a", "b", "c"])).toEqual(["b", "c"]);
  });

  test("keeps attached surveys the picker does not list", () => {
    expect(mergePickedSurveyIds(["hidden", "a"], [], ["a", "b"])).toEqual(["hidden"]);
  });
});
