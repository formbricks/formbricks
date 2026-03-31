import { beforeEach, describe, expect, test, vi } from "vitest";
import { sendToPipeline } from "@/app/lib/pipelines";
import { getResponse } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { updateResponseWithQuotaEvaluation } from "./lib/response";
import { getValidatedUpdateInput } from "./lib/validated-update-input";
import { putResponseHandler } from "./route";

vi.mock("@/app/lib/api/with-api-logging", () => ({
  withV1ApiWrapper: vi.fn(({ handler }) => handler),
}));

vi.mock("@/app/lib/pipelines", () => ({
  sendToPipeline: vi.fn(),
}));

vi.mock("@/lib/response/service", () => ({
  getResponse: vi.fn(),
}));

vi.mock("@/lib/survey/service", () => ({
  getSurvey: vi.fn(),
}));

vi.mock("./lib/response", () => ({
  updateResponseWithQuotaEvaluation: vi.fn(),
}));

vi.mock("./lib/validated-update-input", () => ({
  getValidatedUpdateInput: vi.fn(),
}));

describe("putResponseHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("rejects updates when the response survey does not belong to the requested environment", async () => {
    vi.mocked(getValidatedUpdateInput).mockResolvedValue({
      responseUpdateInput: {
        data: {},
      },
    });
    vi.mocked(getResponse).mockResolvedValue({
      id: "response_123",
      surveyId: "survey_123",
      data: {},
      finished: false,
      language: "en",
    } as unknown as Awaited<ReturnType<typeof getResponse>>);
    vi.mocked(getSurvey).mockResolvedValue({
      id: "survey_123",
      environmentId: "different_environment",
      blocks: [],
      questions: [],
    } as unknown as Awaited<ReturnType<typeof getSurvey>>);

    const result = await putResponseHandler({
      req: new Request("https://api.test/api/v1/client/environment_a/responses/response_123", {
        method: "PUT",
      }) as never,
      props: {
        params: Promise.resolve({
          environmentId: "environment_a",
          responseId: "response_123",
        }),
      },
    });

    expect(result.response.status).toBe(404);
    await expect(result.response.json()).resolves.toEqual({
      code: "not_found",
      message: "Response not found",
      details: {
        resource_id: "response_123",
        resource_type: "Response",
      },
    });
    expect(updateResponseWithQuotaEvaluation).not.toHaveBeenCalled();
    expect(sendToPipeline).not.toHaveBeenCalled();
  });
});
