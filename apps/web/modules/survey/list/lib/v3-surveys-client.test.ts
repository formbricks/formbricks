import { afterEach, describe, expect, test, vi } from "vitest";
import type { TV3CreateSurveyBody } from "@/app/api/v3/surveys/schemas";
import type { V3ApiError } from "@/modules/api/lib/v3-client";
import {
  buildSurveyListSearchParams,
  createV3Survey,
  deleteSurvey,
  generateSurveyCreatePayload,
  validateSurveyCreatePayload,
} from "./v3-surveys-client";

const surveyPayload = {
  workspaceId: "cm4workspace0000000000000000",
  type: "link",
  name: "Generated survey",
  status: "draft",
  languages: [{ code: "en-US", default: true }],
  blocks: [],
  endings: [],
} as unknown as TV3CreateSurveyBody;

afterEach(() => {
  vi.restoreAllMocks();
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

describe("v3 survey write helpers", () => {
  test("generates a survey create payload", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            language: "en-US",
            payload: surveyPayload,
            validation: {
              valid: true,
              invalid_params: [],
              languages: [{ code: "en-US", default: true, enabled: true }],
            },
          },
        }),
        { status: 200 }
      )
    );

    const result = await generateSurveyCreatePayload({
      workspaceId: "cm4workspace0000000000000000",
      prompt: "Measure whether onboarding explains the core product value clearly.",
      type: "link",
      language: "en-US",
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/v3/surveys/generate", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workspaceId: "cm4workspace0000000000000000",
        prompt: "Measure whether onboarding explains the core product value clearly.",
        type: "link",
        language: "en-US",
      }),
    });
    expect(result.language).toBe("en-US");
    expect(result.payload).toEqual(surveyPayload);
    expect(result.validation.valid).toBe(true);
    expect(result.validation.languages).toEqual([{ code: "en-US", default: true, enabled: true }]);
  });

  test("validates a generated create payload", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            valid: true,
            operation: "create",
            invalid_params: [],
          },
        }),
        { status: 200 }
      )
    );

    const result = await validateSurveyCreatePayload(surveyPayload);

    expect(fetchMock).toHaveBeenCalledWith("/api/v3/surveys/validate", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        operation: "create",
        data: surveyPayload,
      }),
    });
    expect(result.valid).toBe(true);
  });

  test("creates the generated survey draft", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: "survey_1",
          },
        }),
        { status: 201 }
      )
    );

    const result = await createV3Survey(surveyPayload);

    expect(fetchMock).toHaveBeenCalledWith("/api/v3/surveys", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(surveyPayload),
    });
    expect(result).toEqual({ id: "survey_1" });
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
