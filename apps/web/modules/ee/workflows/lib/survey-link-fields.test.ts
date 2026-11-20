import { describe, expect, test } from "vitest";
import { getSurveyLinkSettableFields } from "./survey-link-fields";

describe("getSurveyLinkSettableFields", () => {
  test("offers the survey's passed-in fields by storage key, not computed ones or the link's own parameters", () => {
    expect(
      getSurveyLinkSettableFields([
        { storageKey: "plan", name: "Plan", source: "ingested", dataType: "string" },
        { storageKey: "score", name: "Score", source: "computed", dataType: "number" },
        { storageKey: "lang", name: "Language", source: "ingested", dataType: "string" },
      ])
    ).toEqual([{ key: "plan", name: "Plan", dataType: "string" }]);
  });
});
