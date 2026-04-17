import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { deleteSurvey } from "./surveys";

const { mockDeleteSharedSurvey } = vi.hoisted(() => ({
  mockDeleteSharedSurvey: vi.fn(),
}));

vi.mock("@/modules/survey/lib/surveys", () => ({
  deleteSurvey: mockDeleteSharedSurvey,
}));

const surveyId = "clq5n7p1q0000m7z0h5p6g3r2";

const mockDeletedSurveyLink = {
  id: surveyId,
  environmentId: "clq5n7p1q0000m7z0h5p6g3r3",
  type: "link",
  segment: null,
  triggers: [],
};

describe("deleteSurvey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("delegates survey deletion to the shared service", async () => {
    mockDeleteSharedSurvey.mockResolvedValue(mockDeletedSurveyLink);

    const deletedSurvey = await deleteSurvey(surveyId);

    expect(mockDeleteSharedSurvey).toHaveBeenCalledWith(surveyId);
    expect(deletedSurvey).toEqual(mockDeletedSurveyLink);
  });

  test("rethrows shared delete service errors", async () => {
    const genericError = new Error("Something went wrong");
    mockDeleteSharedSurvey.mockRejectedValue(genericError);

    await expect(deleteSurvey(surveyId)).rejects.toThrow(genericError);
    expect(mockDeleteSharedSurvey).toHaveBeenCalledWith(surveyId);
  });
});
