// import { environmentId, responseId, surveyId } from "./__mocks__/helper.mock";
// import { getResponseSurveyId, getSurveyEnvironmentId } from "@/modules/api/management/lib/services";
// import { ApiErrorResponse } from "@/modules/api/types/api-error";
// import { beforeEach, describe, expect, test, vi } from "vitest";
// import { err, ok } from "@formbricks/types/error-handlers";
// import { getEnvironmentIdFromResponseId, getEnvironmentIdFromSurveyId } from "../helper";
// vi.mock("@/modules/api/management/lib/services", () => ({
//   getSurveyEnvironmentId: vi.fn(),
//   getResponseSurveyId: vi.fn(),
// }));
// describe("API Management Helper", () => {
//   beforeEach(() => {
//     vi.clearAllMocks();
//   });
//   describe("getEnvironmentIdFromSurveyId", () => {
//     test("should return ok with environmentId when survey is found", async () => {
//       vi.mocked(getSurveyEnvironmentId).mockResolvedValue(ok({ environmentId }));
//       const result = await getEnvironmentIdFromSurveyId(surveyId);
//       expect(getSurveyEnvironmentId).toHaveBeenCalledWith(surveyId);
//       expect(result.ok).toBe(true);
//       if (result.ok) {
//         expect(result.data).toBe(environmentId);
//       }
//     });
//     test("should return error when survey is not found", async () => {
//       const errorResponse = {
//         type: "not_found",
//         details: [{ field: "survey", issue: "not found" }],
//       } as ApiErrorResponse;
//       vi.mocked(getSurveyEnvironmentId).mockResolvedValue(err(errorResponse));
//       const result = await getEnvironmentIdFromSurveyId(surveyId);
//       expect(getSurveyEnvironmentId).toHaveBeenCalledWith(surveyId);
//       expect(result.ok).toBe(false);
//       if (!result.ok) {
//         expect(result.error).toEqual(errorResponse);
//       }
//     });
//   });
//   describe("getEnvironmentIdFromResponseId", () => {
//     test("should return ok with environmentId when both response and survey are found", async () => {
//       vi.mocked(getResponseSurveyId).mockResolvedValue(ok({ surveyId }));
//       vi.mocked(getSurveyEnvironmentId).mockResolvedValue(ok({ environmentId }));
//       const result = await getEnvironmentIdFromResponseId(responseId);
//       expect(getResponseSurveyId).toHaveBeenCalledWith(responseId);
//       expect(getSurveyEnvironmentId).toHaveBeenCalledWith(surveyId);
//       expect(result.ok).toBe(true);
//       if (result.ok) {
//         expect(result.data).toBe(environmentId);
//       }
//     });
//     test("should return error when response is not found", async () => {
//       const errorResponse = {
//         type: "not_found",
//         details: [{ field: "response", issue: "not found" }],
//       } as ApiErrorResponse;
//       vi.mocked(getResponseSurveyId).mockResolvedValue(err(errorResponse));
//       const result = await getEnvironmentIdFromResponseId(responseId);
//       expect(getResponseSurveyId).toHaveBeenCalledWith(responseId);
//       expect(result.ok).toBe(false);
//       if (!result.ok) {
//         expect(result.error).toEqual(errorResponse);
//       }
//       expect(getSurveyEnvironmentId).not.toHaveBeenCalled();
//     });
//     test("should return error when survey is not found even if response is found", async () => {
//       const errorResponse = {
//         type: "not_found",
//         details: [{ field: "survey", issue: "not found" }],
//       } as ApiErrorResponse;
//       vi.mocked(getResponseSurveyId).mockResolvedValue(ok({ surveyId }));
//       vi.mocked(getSurveyEnvironmentId).mockResolvedValue(err(errorResponse));
//       const result = await getEnvironmentIdFromResponseId(responseId);
//       expect(getResponseSurveyId).toHaveBeenCalledWith(responseId);
//       expect(getSurveyEnvironmentId).toHaveBeenCalledWith(surveyId);
//       expect(result.ok).toBe(false);
//       if (!result.ok) {
//         expect(result.error).toEqual(errorResponse);
//       }
//     });
//   });
// });
import { ApiErrorResponse } from "@/modules/api/types/api-error";
import { describe, expect, it, vi } from "vitest";
import { err, ok } from "@formbricks/types/error-handlers";
import { getEnvironmentId } from "../helper";
import { getSurveyAndEnvironmentId } from "../services";

vi.mock("../services", () => ({
  getSurveyAndEnvironmentId: vi.fn(),
}));

describe("Helper Functions", () => {
  it("should return environmentId for surveyId", async () => {
    vi.mocked(getSurveyAndEnvironmentId).mockResolvedValue(
      ok({ surveyId: "survey-id", environmentId: "env-id" })
    );

    const result = await getEnvironmentId("survey-id", false);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe("env-id");
    }
  });

  it("should return environmentId for responseId", async () => {
    vi.mocked(getSurveyAndEnvironmentId).mockResolvedValue(
      ok({ surveyId: "survey-id", environmentId: "env-id" })
    );

    const result = await getEnvironmentId("response-id", true);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe("env-id");
    }
  });

  it("should return error if getSurveyAndEnvironmentId fails", async () => {
    vi.mocked(getSurveyAndEnvironmentId).mockResolvedValue(
      err({ type: "not_found" } as unknown as ApiErrorResponse)
    );

    const result = await getEnvironmentId("invalid-id", true);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("not_found");
    }
  });
});
