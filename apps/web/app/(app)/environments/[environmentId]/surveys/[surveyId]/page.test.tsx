import { redirect } from "next/navigation";
import { describe, expect, test, vi } from "vitest";
import Page from "./page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

describe("SurveyPage", () => {
  test("should redirect to the survey summary page", async () => {
    const params = {
      environmentId: "testEnvId",
      surveyId: "testSurveyId",
    };
    const props = { params };

    await Page(props);

    expect(vi.mocked(redirect)).toHaveBeenCalledWith(
      `/environments/${params.environmentId}/surveys/${params.surveyId}/summary`
    );
  });
});
