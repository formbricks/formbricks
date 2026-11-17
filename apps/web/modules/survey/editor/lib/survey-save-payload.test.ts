import { describe, expect, test } from "vitest";
import { TSurvey } from "@formbricks/types/surveys/types";
import {
  buildSurveySavePayload,
  parseSurveyEndings,
  removeDraftFlagsFromBlocks,
} from "./survey-save-payload";

describe("removeDraftFlagsFromBlocks", () => {
  test("drops isDraft from every element and keeps the rest", () => {
    const blocks = [
      {
        id: "b1",
        name: "Block 1",
        elements: [
          { id: "e1", type: "openText", isDraft: true },
          { id: "e2", type: "openText" },
        ],
      },
    ] as unknown as Parameters<typeof removeDraftFlagsFromBlocks>[0];

    const result = removeDraftFlagsFromBlocks(blocks);

    expect(result[0].id).toBe("b1");
    expect(result[0].elements).toEqual([
      { id: "e1", type: "openText" },
      { id: "e2", type: "openText" },
    ]);
  });
});

describe("parseSurveyEndings", () => {
  test("parses redirect and end screen endings with their own schema", () => {
    const endings = [
      { id: "end1", type: "endScreen", headline: { default: "Thanks" } },
      { id: "end2", type: "redirectToUrl", url: "https://example.com", label: "Go" },
    ] as unknown as TSurvey["endings"];

    const result = parseSurveyEndings(endings);

    expect(result.map((ending) => ending.type)).toEqual(["endScreen", "redirectToUrl"]);
  });
});

describe("buildSurveySavePayload", () => {
  // A fresh survey per test: a helper that normalised its input in place would otherwise leave a shared
  // fixture normalised, and the non-mutation test would compare normalised against normalised.
  const makeSurvey = () =>
    ({
      id: "s1",
      name: "Survey",
      questions: [{ id: "legacy" }],
      blocks: [{ id: "b1", name: "Block 1", elements: [{ id: "e1", type: "openText", isDraft: true }] }],
      endings: [{ id: "end1", type: "endScreen", headline: { default: "Thanks" } }],
    }) as unknown as TSurvey;

  test("strips draft flags, empties the legacy questions and parses the endings", () => {
    const payload = buildSurveySavePayload(makeSurvey());

    expect(payload.id).toBe("s1");
    expect(payload.questions).toEqual([]);
    expect(payload.blocks[0].elements).toEqual([{ id: "e1", type: "openText" }]);
    expect(payload.endings.map((ending) => ending.id)).toEqual(["end1"]);
  });

  test("leaves the editor's survey untouched, so a failed save keeps its draft flags", () => {
    const survey = makeSurvey();
    const before = structuredClone(survey);

    buildSurveySavePayload(survey);

    expect(survey).toEqual(before);
  });
});
