import { afterEach, describe, expect, test, vi } from "vitest";
import type { V3ApiError } from "@/modules/api/lib/v3-client";
import { buildSurveyListSearchParams, deleteSurvey } from "./v3-surveys-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  test("emits includeTotalCount=false when requested", () => {
    const searchParams = buildSurveyListSearchParams({
      workspaceId: "env_1",
      limit: 20,
      cursor: "cursor_1",
      includeTotalCount: false,
      filters: {
        name: "",
        status: [],
        type: [],
        sortBy: "relevance",
      },
    });

    expect(searchParams.toString()).toBe(
      "workspaceId=env_1&limit=20&sortBy=relevance&cursor=cursor_1&includeTotalCount=false"
    );
  });
});

describe("deleteSurvey", () => {
  test("treats 204 No Content as a successful delete", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteSurvey("survey_1")).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith("/api/v3/surveys/survey_1", {
      method: "DELETE",
      cache: "no-store",
    });
  });

  test("maps v3 problem responses to V3ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            status: 403,
            detail: "You are not authorized to access this resource",
            code: "forbidden",
          },
          { status: 403 }
        )
      )
    );

    await expect(deleteSurvey("survey_1")).rejects.toMatchObject<V3ApiError>({
      status: 403,
      detail: "You are not authorized to access this resource",
      code: "forbidden",
    });
  });
});
