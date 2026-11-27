import { describe, expect, test } from "vitest";
import { ZIntegrationPutBodyByType, toIntegrationMappingBody } from "./schemas";

const createdAt = new Date("2026-10-01T10:00:00.000Z");

describe("toIntegrationMappingBody", () => {
  // A stored mapping can carry fields an older release wrote; the strict PUT would refuse them.
  test("keeps only the fields the PUT accepts, so a stored mapping round-trips", () => {
    const stored = {
      createdAt,
      elementIds: ["q1"],
      elements: "All questions",
      surveyId: "survey1",
      surveyName: "Onboarding",
      channelId: "C1",
      channelName: "feedback",
      questionIds: ["q1"],
    };

    const body = toIntegrationMappingBody("slack", stored);

    expect(body).not.toHaveProperty("questionIds");
    const parsed = ZIntegrationPutBodyByType.slack.safeParse(
      JSON.parse(JSON.stringify({ config: { data: [body] } }))
    );
    expect(parsed.success).toBe(true);
    expect(parsed.data?.config.data[0].createdAt).toEqual(createdAt);
  });

  test("reduces a Notion mapping's element-to-column pairs too", () => {
    const body = toIntegrationMappingBody("notion", {
      createdAt,
      surveyId: "survey1",
      surveyName: "Onboarding",
      databaseId: "db1",
      databaseName: "Feedback",
      mapping: [
        {
          element: { id: "q1", name: "Liked", type: "openText" },
          column: { id: "c1", name: "Liked", type: "rich_text" },
          error: { type: "mismatch", msg: "stale" },
        } as never,
      ],
    });

    expect(body.mapping).toEqual([
      {
        element: { id: "q1", name: "Liked", type: "openText" },
        column: { id: "c1", name: "Liked", type: "rich_text" },
      },
    ]);
  });
});
