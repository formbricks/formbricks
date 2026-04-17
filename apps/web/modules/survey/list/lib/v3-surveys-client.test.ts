import { describe, expect, test } from "vitest";
import { buildSurveyListSearchParams } from "./v3-surveys-client";

describe("buildSurveyListSearchParams", () => {
  test("emits only supported v3 params using normalized filter values", () => {
    const searchParams = buildSurveyListSearchParams({
      workspaceId: "env_1",
      limit: 20,
      cursor: "cursor_1",
      filters: {
        name: "  Product feedback  ",
        status: ["paused", "draft"],
        type: ["link", "app"],
        sortBy: "relevance",
      },
    });

    expect(searchParams.toString()).toBe(
      "workspaceId=env_1&limit=20&sortBy=relevance&cursor=cursor_1&filter%5Bname%5D%5Bcontains%5D=Product+feedback&filter%5Bstatus%5D%5Bin%5D=draft&filter%5Bstatus%5D%5Bin%5D=paused&filter%5Btype%5D%5Bin%5D=app&filter%5Btype%5D%5Bin%5D=link"
    );
  });
});
