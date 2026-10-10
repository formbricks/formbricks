import { describe, expect, test } from "vitest";
import {
  CHECK_PREFIX,
  buildLoopSurvey,
  buildStorageSurvey,
  selectStaleSurveyIds,
  surveyName,
} from "./survey.ts";

const NOW = new Date("2026-10-07T12:00:00.000Z");
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();

describe("survey builders", () => {
  test("every created survey carries the deployment-check prefix", () => {
    expect(surveyName("x", NOW).startsWith(CHECK_PREFIX)).toBe(true);
    expect(buildLoopSurvey("ws", NOW).name.startsWith(CHECK_PREFIX)).toBe(true);
    expect(buildStorageSurvey("ws", NOW).name.startsWith(CHECK_PREFIX)).toBe(true);
  });

  test("the loop survey is a published link survey with an open-text and a rating question", () => {
    const survey = buildLoopSurvey("ws", NOW);

    expect(survey).toMatchObject({ workspaceId: "ws", type: "link", status: "inProgress" });
    expect(survey.blocks[0].elements.map((element) => element.type)).toEqual(["openText", "rating"]);
  });

  test("the storage survey allows exactly one optional png upload", () => {
    const element = buildStorageSurvey("ws", NOW).blocks[0].elements[0];

    expect(element).toMatchObject({ type: "fileUpload", allowedFileExtensions: ["png"] });
  });
});

describe("selectStaleSurveyIds", () => {
  const survey = (id: string, name: string, age: number) => ({ id, name, createdAt: minutesAgo(age) });

  test("selects prefixed surveys older than an hour", () => {
    const surveys = [survey("old", `${CHECK_PREFIX} a`, 90), survey("fresh", `${CHECK_PREFIX} b`, 5)];

    expect(selectStaleSurveyIds(surveys, NOW, [])).toEqual(["old"]);
  });

  test("never selects a survey this tool did not create", () => {
    expect(selectStaleSurveyIds([survey("mine", "Customer NPS", 500)], NOW, [])).toEqual([]);
  });

  test("skips ids the run already deleted", () => {
    expect(selectStaleSurveyIds([survey("old", `${CHECK_PREFIX} a`, 90)], NOW, ["old"])).toEqual([]);
  });
});
