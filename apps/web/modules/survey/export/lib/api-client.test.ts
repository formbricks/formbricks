import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { fetchSurveyExport } from "./api-client";

const SURVEY_ID = "clsurvey0000000000000001";

const problem = (status: number, code: string) =>
  new Response(JSON.stringify({ status, code, detail: "English text from the server" }), {
    status,
    headers: { "Content-Type": "application/problem+json" },
  });

describe("fetchSurveyExport", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("fetches the survey's file uncached, and returns its bytes under the UTF-8 name the server gave it", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response('{"formbricks":{}}', {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="Gro_e NPS.formbricks.json"; filename*=UTF-8''Gr%C3%B6%C3%9Fe%20NPS.formbricks.json`,
        },
      })
    );

    const file = await fetchSurveyExport({ surveyId: SURVEY_ID, format: "json" });

    expect(global.fetch).toHaveBeenCalledWith(
      `/api/internal/surveys/${SURVEY_ID}/export?format=json`,
      expect.objectContaining({ method: "GET", cache: "no-store" })
    );
    expect(file.fileName).toBe("Größe NPS.formbricks.json");
    expect(await file.blob.text()).toBe('{"formbricks":{}}');
  });

  test("names the file itself when the response doesn't", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(new Response("{}", { status: 200 }));

    expect((await fetchSurveyExport({ surveyId: SURVEY_ID, format: "json" })).fileName).toBe(
      "survey.formbricks.json"
    );
  });

  test.each([
    [403, "forbidden"],
    [429, "too_many_requests"],
  ])("throws a %i refusal as a problem rather than saving it as the file", async (status, code) => {
    vi.mocked(global.fetch).mockResolvedValueOnce(problem(status, code));

    const error = await fetchSurveyExport({ surveyId: SURVEY_ID, format: "json" }).catch(
      (caught: unknown) => caught
    );

    expect(error).toBeInstanceOf(V3ApiError);
    expect(error).toMatchObject({ status, code, detail: "English text from the server" });
  });
});
