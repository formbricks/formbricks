import { environmentId, responseId, surveyId } from "./__mocks__/helper.mock";
import { getResponse, getSurvey } from "@/modules/api/management/lib/services";
import { ApiErrorResponse } from "@/modules/api/types/api-error";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { err, ok } from "@formbricks/types/error-handlers";
import { getEnvironmentIdFromResponseId, getEnvironmentIdFromSurveyId } from "../helper";

vi.mock("@/modules/api/management/lib/services", () => ({
  getSurvey: vi.fn(),
  getResponse: vi.fn(),
}));

describe("API Management Helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getEnvironmentIdFromSurveyId", () => {
    test("should return ok with environmentId when survey is found", async () => {
      vi.mocked(getSurvey).mockResolvedValue(ok({ environmentId }));

      const result = await getEnvironmentIdFromSurveyId(surveyId);

      expect(getSurvey).toHaveBeenCalledWith(surveyId);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe(environmentId);
      }
    });

    test("should return error when survey is not found", async () => {
      const errorResponse = {
        type: "not_found",
        details: [{ field: "survey", issue: "not found" }],
      } as ApiErrorResponse;

      vi.mocked(getSurvey).mockResolvedValue(err(errorResponse));

      const result = await getEnvironmentIdFromSurveyId(surveyId);

      expect(getSurvey).toHaveBeenCalledWith(surveyId);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual(errorResponse);
      }
    });
  });

  describe("getEnvironmentIdFromResponseId", () => {
    test("should return ok with environmentId when both response and survey are found", async () => {
      vi.mocked(getResponse).mockResolvedValue(ok({ surveyId }));
      vi.mocked(getSurvey).mockResolvedValue(ok({ environmentId }));

      const result = await getEnvironmentIdFromResponseId(responseId);

      expect(getResponse).toHaveBeenCalledWith(responseId);
      expect(getSurvey).toHaveBeenCalledWith(surveyId);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe(environmentId);
      }
    });

    test("should return error when response is not found", async () => {
      const errorResponse = {
        type: "not_found",
        details: [{ field: "response", issue: "not found" }],
      } as ApiErrorResponse;

      vi.mocked(getResponse).mockResolvedValue(err(errorResponse));

      const result = await getEnvironmentIdFromResponseId(responseId);

      expect(getResponse).toHaveBeenCalledWith(responseId);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual(errorResponse);
      }
      expect(getSurvey).not.toHaveBeenCalled();
    });

    test("should return error when survey is not found even if response is found", async () => {
      const errorResponse = {
        type: "not_found",
        details: [{ field: "survey", issue: "not found" }],
      } as ApiErrorResponse;

      vi.mocked(getResponse).mockResolvedValue(ok({ surveyId }));
      vi.mocked(getSurvey).mockResolvedValue(err(errorResponse));

      const result = await getEnvironmentIdFromResponseId(responseId);

      expect(getResponse).toHaveBeenCalledWith(responseId);
      expect(getSurvey).toHaveBeenCalledWith(surveyId);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual(errorResponse);
      }
    });
  });
});
