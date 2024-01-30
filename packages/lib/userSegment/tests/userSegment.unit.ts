import { getMockUserSegmentFilters, mockEvaluateSegmentUserData } from "./__mocks__/userSegment.mock";

import { prismaMock } from "@formbricks/database/src/jestClient";

import { evaluateSegment } from "../service";

describe("Tests for evaluateSegmentService", () => {
  describe("Happy Path", () => {
    it("Returns true when the user meets the segment criteria", async () => {
      prismaMock.action.count.mockResolvedValue(4);
      const result = await evaluateSegment(
        mockEvaluateSegmentUserData,
        getMockUserSegmentFilters("lastQuarterCount", 5, "lessThan")
      );
      expect(result).toBe(true);
    });

    it("Calculates the action count for the last month", async () => {
      prismaMock.action.count.mockResolvedValue(0);
      const result = await evaluateSegment(
        mockEvaluateSegmentUserData,
        getMockUserSegmentFilters("lastMonthCount", 5, "lessThan")
      );
      expect(result).toBe(true);
    });

    it("Calculates the action count for the last week", async () => {
      prismaMock.action.count.mockResolvedValue(6);
      const result = await evaluateSegment(
        mockEvaluateSegmentUserData,
        getMockUserSegmentFilters("lastWeekCount", 5, "greaterEqual")
      );
      expect(result).toBe(true);
    });

    it("Calculates the total occurences of action", async () => {
      prismaMock.action.count.mockResolvedValue(6);
      const result = await evaluateSegment(
        mockEvaluateSegmentUserData,
        getMockUserSegmentFilters("lastWeekCount", 5, "greaterEqual")
      );
      expect(result).toBe(true);
    });
  });

  describe("Sad Path", () => {
    it("Returns false when the user does not meet the segment criteria", async () => {
      prismaMock.action.count.mockResolvedValue(0);
      const result = await evaluateSegment(
        mockEvaluateSegmentUserData,
        getMockUserSegmentFilters("lastQuarterCount", 5, "greaterThan")
      );
      expect(result).toBe(false);
    });
  });
});
