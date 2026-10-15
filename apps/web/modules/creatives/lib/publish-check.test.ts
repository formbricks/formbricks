import { describe, expect, test } from "vitest";
import { MOCK_CREATIVES, createMockDraft } from "../mock/data";
import type { TCreative } from "../types";
import { getPublishIssues } from "./publish-check";
import { createCondition } from "./show-conditions-ui";

const ready: TCreative = MOCK_CREATIVES[0];

describe("getPublishIssues", () => {
  test("a complete creative has nothing blocking Publish", () => {
    expect(getPublishIssues(ready)).toEqual([]);
  });

  test("a fresh draft needs a name and a survey", () => {
    expect(getPublishIssues(createMockDraft("feedback_button"))).toEqual(["name_missing", "survey_missing"]);
  });

  test("a banner needs a message, and a link must be http(s)", () => {
    const banner: TCreative = {
      ...ready,
      type: "banner",
      content: { ...ready.content, message: "  " },
      action: { kind: "link", url: "javascript:alert(1)" },
    };
    expect(getPublishIssues(banner)).toEqual(["message_missing", "link_invalid"]);
    expect(
      getPublishIssues({
        ...banner,
        content: { ...banner.content, message: "Hi" },
        action: { kind: "link", url: "https://example.com/x" },
      })
    ).toEqual([]);
  });

  test("empty page conditions and an end before the start block Publish", () => {
    const creative: TCreative = {
      ...ready,
      targeting: {
        ...ready.targeting,
        showConditions: { id: "g", connector: "and", conditions: [createCondition("currentUrl", "c")] },
      },
      startsAt: new Date(2026, 9, 15, 9),
      endsAt: new Date(2026, 9, 15, 8),
    };
    expect(getPublishIssues(creative)).toEqual(["condition_empty", "end_before_start"]);
  });
});
