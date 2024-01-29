import { mockEvaluateSegmentUserData, mockUserSegmentFilters } from "./__mocks__/userSegment.mock";

import { prismaMock } from "@formbricks/database/src/jestClient";

import { evaluateSegment } from "../service";

describe("Tests for evaluateSegmentService", () => {
  describe("Happy Path", () => {
    it("Returns true when the user meets the segment criteria", async () => {
      prismaMock.action.count.mockResolvedValue(6);
      const result = await evaluateSegment(mockEvaluateSegmentUserData, mockUserSegmentFilters);
      expect(result).toBe(true);
    });
  });

  describe("Sad Path", () => {
    it("Returns false when the user does not meet the segment criteria", async () => {
      prismaMock.action.count.mockResolvedValue(0);
      const result = await evaluateSegment(mockEvaluateSegmentUserData, mockUserSegmentFilters);
      expect(result).toBe(false);
    });
  });
});
