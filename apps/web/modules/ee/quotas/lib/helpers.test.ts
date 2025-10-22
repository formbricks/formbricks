import { describe, expect, test } from "vitest";
import { createQuotaFullObject } from "@/modules/ee/quotas/lib/helpers";

describe("helpers", () => {
  describe("createQuotaFullObject", () => {
    test("should return quotaFull: false when quota is not provided", () => {
      const result = createQuotaFullObject();
      expect(result).toEqual({ quotaFull: false });
    });

    test("should return quotaFull: true when quota is provided", () => {
      const result = createQuotaFullObject({
        id: "1",
        action: "endSurvey",
        countPartialSubmissions: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        surveyId: "1",
        name: "1",
        limit: 1,
        logic: { connector: "and", conditions: [] },
        endingCardId: "e1",
      });
      expect(result).toEqual({
        quotaFull: true,
        quota: { id: "1", action: "endSurvey", endingCardId: "e1" },
      });

      const result2 = createQuotaFullObject({
        id: "1",
        action: "endSurvey",
        endingCardId: "2",
        countPartialSubmissions: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        surveyId: "1",
        name: "1",
        limit: 1,
        logic: { connector: "and", conditions: [] },
      });
      expect(result2).toEqual({
        quotaFull: true,
        quota: { id: "1", action: "endSurvey", endingCardId: "2" },
      });

      const result3 = createQuotaFullObject({
        id: "1",
        action: "endSurvey",
        createdAt: new Date(),
        updatedAt: new Date(),
        surveyId: "1",
        name: "1",
        limit: 1,
        logic: { connector: "and", conditions: [] },
        countPartialSubmissions: false,
        endingCardId: null,
      });
      expect(result3).toEqual({
        quotaFull: true,
        quota: { id: "1", action: "endSurvey" },
      });
    });
  });
});
