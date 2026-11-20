import { describe, expect, test } from "vitest";
import { ZSegmentCreateInput } from "./segment";

const filters = [
  {
    id: "clfilter0000000000000001",
    connector: null,
    resource: {
      id: "clresource00000000000001",
      root: { type: "attribute" as const, contactAttributeKey: "email" },
      value: "user@example.com",
      qualifier: { operator: "equals" as const },
    },
  },
];

describe("ZSegmentCreateInput (ENG-6956)", () => {
  const base = { workspaceId: "workspaceId", filters, isPrivate: true };

  test("a private segment is titled with the id of its own survey", () => {
    expect(ZSegmentCreateInput.safeParse({ ...base, title: "surveyId", surveyId: "surveyId" }).success).toBe(
      true
    );
  });

  test("a private segment titled with another survey's id is refused on the title", () => {
    const result = ZSegmentCreateInput.safeParse({ ...base, title: "otherSurveyId", surveyId: "surveyId" });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["title"]);
  });

  test("a segment is private unless the caller says otherwise", () => {
    const { isPrivate: _isPrivate, ...withoutFlag } = base;

    expect(
      ZSegmentCreateInput.safeParse({ ...withoutFlag, title: "otherSurveyId", surveyId: "surveyId" }).success
    ).toBe(false);
    expect(
      ZSegmentCreateInput.parse({ ...withoutFlag, title: "surveyId", surveyId: "surveyId" })
    ).toMatchObject({
      isPrivate: true,
      title: "surveyId",
    });
  });

  test("a private segment needs a survey: an empty id would equal an empty title", () => {
    expect(ZSegmentCreateInput.safeParse({ ...base, title: "", surveyId: "" }).success).toBe(false);
  });

  test("a shared segment keeps any title, with or without a survey", () => {
    const shared = { ...base, isPrivate: false, title: "Power users" };

    expect(ZSegmentCreateInput.safeParse({ ...shared, surveyId: "" }).success).toBe(true);
    expect(ZSegmentCreateInput.safeParse({ ...shared, surveyId: "surveyId" }).success).toBe(true);
  });
});
