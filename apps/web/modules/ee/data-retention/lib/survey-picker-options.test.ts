import { describe, expect, test } from "vitest";
import { groupSurveyOptionsByWorkspace } from "./survey-picker-options";

const csat = { id: "s1", name: "CSAT", workspaceName: "Web" };
const nps = { id: "s2", name: "NPS", workspaceName: "App" };
const exit = { id: "s3", name: "Exit", workspaceName: "Web" };

describe("groupSurveyOptionsByWorkspace", () => {
  test("groups surveys by workspace in the order the server returned them", () => {
    expect(groupSurveyOptionsByWorkspace([csat, nps, exit], null)).toEqual([
      {
        label: "Web",
        value: "Web",
        options: [
          { label: "CSAT", value: "s1" },
          { label: "Exit", value: "s3" },
        ],
      },
      { label: "App", value: "App", options: [{ label: "NPS", value: "s2" }] },
    ]);
  });

  test("keeps the chosen survey when the search no longer returns it", () => {
    expect(groupSurveyOptionsByWorkspace([nps], csat)).toEqual([
      { label: "Web", value: "Web", options: [{ label: "CSAT", value: "s1" }] },
      { label: "App", value: "App", options: [{ label: "NPS", value: "s2" }] },
    ]);
  });

  test("does not list the chosen survey twice", () => {
    expect(groupSurveyOptionsByWorkspace([csat], csat)[0].options).toEqual([{ label: "CSAT", value: "s1" }]);
  });
});
