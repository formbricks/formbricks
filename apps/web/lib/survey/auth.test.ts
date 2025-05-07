import { cache } from "@/lib/cache";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ZId } from "@formbricks/types/common";
import { TSurvey } from "@formbricks/types/surveys/types";
import { hasUserEnvironmentAccess } from "../environment/auth";
import { validateInputs } from "../utils/validate";
import { canUserAccessSurvey } from "./auth";
import { surveyCache } from "./cache";
import { getSurvey } from "./service";

// Mock dependencies
vi.mock("@/lib/cache", () => ({
  cache: vi.fn((fn) => fn),
}));

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

vi.mock("./service", () => ({
  getSurvey: vi.fn(),
}));

vi.mock("../environment/auth", () => ({
  hasUserEnvironmentAccess: vi.fn(),
}));

vi.mock("./cache", () => ({
  surveyCache: {
    tag: {
      byId: vi.fn().mockReturnValue("survey-tag-id"),
    },
  },
}));

describe("canUserAccessSurvey", () => {
  const userId = "user-123";
  const surveyId = "survey-456";
  const environmentId = "env-789";

  const mockSurvey = {
    id: surveyId,
    environmentId: environmentId,
  } as TSurvey;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(cache).mockImplementation((fn) => () => fn());
    vi.mocked(getSurvey).mockResolvedValue(mockSurvey);
    vi.mocked(hasUserEnvironmentAccess).mockResolvedValue(true);
    vi.mocked(surveyCache.tag.byId).mockReturnValue(`survey-${surveyId}`);
  });

  test("validates input parameters", async () => {
    await canUserAccessSurvey(userId, surveyId);
    expect(validateInputs).toHaveBeenCalledWith([surveyId, ZId], [userId, ZId]);
  });

  test("returns false if userId is falsy", async () => {
    const result = await canUserAccessSurvey("", surveyId);
    expect(result).toBe(false);
    expect(getSurvey).not.toHaveBeenCalled();
  });

  test("returns false if survey is not found", async () => {
    vi.mocked(getSurvey).mockResolvedValueOnce(null);

    await expect(canUserAccessSurvey(userId, surveyId)).rejects.toThrowError("Survey not found");
    expect(getSurvey).toHaveBeenCalledWith(surveyId);
    expect(hasUserEnvironmentAccess).not.toHaveBeenCalled();
  });

  test("calls hasUserEnvironmentAccess with userId and survey's environmentId", async () => {
    await canUserAccessSurvey(userId, surveyId);

    expect(getSurvey).toHaveBeenCalledWith(surveyId);
    expect(hasUserEnvironmentAccess).toHaveBeenCalledWith(userId, environmentId);
  });

  test("returns false if user doesn't have access to the environment", async () => {
    vi.mocked(hasUserEnvironmentAccess).mockResolvedValueOnce(false);

    const result = await canUserAccessSurvey(userId, surveyId);

    expect(result).toBe(false);
    expect(getSurvey).toHaveBeenCalledWith(surveyId);
    expect(hasUserEnvironmentAccess).toHaveBeenCalledWith(userId, environmentId);
  });

  test("returns true if user has access to the environment", async () => {
    const result = await canUserAccessSurvey(userId, surveyId);

    expect(result).toBe(true);
    expect(getSurvey).toHaveBeenCalledWith(surveyId);
    expect(hasUserEnvironmentAccess).toHaveBeenCalledWith(userId, environmentId);
  });

  test("rethrows errors that occur during execution", async () => {
    const error = new Error("Test error");
    vi.mocked(getSurvey).mockRejectedValueOnce(error);

    await expect(canUserAccessSurvey(userId, surveyId)).rejects.toThrow(error);
  });

  test("uses cache with correct cache key and tags", async () => {
    await canUserAccessSurvey(userId, surveyId);

    expect(cache).toHaveBeenCalledWith(expect.any(Function), [`canUserAccessSurvey-${userId}-${surveyId}`], {
      tags: [`survey-${surveyId}`],
    });
    expect(surveyCache.tag.byId).toHaveBeenCalledWith(surveyId);
  });
});
