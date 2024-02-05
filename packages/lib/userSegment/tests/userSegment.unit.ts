import {
  getMockUserSegmentFilters,
  mockEnvironmentId,
  mockEvaluateSegmentUserData,
  mockSurveyId,
  mockUserSegment,
  mockUserSegmentCreateInput,
  mockUserSegmentId,
  mockUserSegmentPrisma,
  mockUserSegmentUpdateInput,
} from "./__mocks__/userSegment.mock";

import { Prisma } from "@prisma/client";

import { prismaMock } from "@formbricks/database/src/jestClient";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";

import { testInputValidation } from "../../jest/jestSetup";
import {
  cloneUserSegment,
  createUserSegment,
  deleteUserSegment,
  evaluateSegment,
  getUserSegment,
  getUserSegments,
  updateUserSegment,
} from "../service";

function addOrSubractDays(date: Date, number: number) {
  return new Date(new Date().setDate(date.getDate() - number));
}

beforeEach(() => {
  prismaMock.userSegment.findUnique.mockResolvedValue(mockUserSegmentPrisma);
  prismaMock.userSegment.findMany.mockResolvedValue([mockUserSegmentPrisma]);
  prismaMock.userSegment.update.mockResolvedValue({
    ...mockUserSegmentPrisma,
    filters: getMockUserSegmentFilters("lastMonthCount", 5, "greaterEqual"),
  });
});

describe("Tests for evaluateSegment service", () => {
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
        getMockUserSegmentFilters("occuranceCount", 5, "greaterEqual")
      );
      expect(result).toBe(true);
    });

    it("Calculates the last occurence days ago of action", async () => {
      prismaMock.action.findFirst.mockResolvedValue({ createdAt: addOrSubractDays(new Date(), 5) } as any);

      const result = await evaluateSegment(
        mockEvaluateSegmentUserData,
        getMockUserSegmentFilters("lastOccurranceDaysAgo", 0, "greaterEqual")
      );
      expect(result).toBe(true);
    });

    it("Calculates the first occurence days ago of action", async () => {
      prismaMock.action.findFirst.mockResolvedValue({ createdAt: addOrSubractDays(new Date(), 5) } as any);

      const result = await evaluateSegment(
        mockEvaluateSegmentUserData,
        getMockUserSegmentFilters("firstOccurranceDaysAgo", 6, "lessThan")
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

describe("Tests for createUserSegment service", () => {
  describe("Happy Path", () => {
    it("Creates a new user segment", async () => {
      prismaMock.userSegment.create.mockResolvedValue(mockUserSegmentPrisma);
      const result = await createUserSegment(mockUserSegmentCreateInput);
      expect(result).toEqual(mockUserSegment);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(createUserSegment, { ...mockUserSegmentCreateInput, title: undefined });

    it("Throws a DatabaseError error if there is a PrismaClientKnownRequestError", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: "P2002",
        clientVersion: "0.0.1",
      });

      prismaMock.userSegment.create.mockRejectedValue(errToThrow);

      await expect(createUserSegment(mockUserSegmentCreateInput)).rejects.toThrow(DatabaseError);
    });

    it("Throws a generic Error for unexpected exceptions", async () => {
      const mockErrorMessage = "Mock error message";
      prismaMock.userSegment.create.mockRejectedValue(new Error(mockErrorMessage));

      await expect(createUserSegment(mockUserSegmentCreateInput)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for getUserSegments service", () => {
  describe("Happy Path", () => {
    it("Returns all user segments", async () => {
      const result = await getUserSegments(mockEnvironmentId);
      expect(result).toEqual([mockUserSegment]);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(getUserSegments, "123");

    it("Throws a DatabaseError error if there is a PrismaClientKnownRequestError", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: "P2002",
        clientVersion: "0.0.1",
      });

      prismaMock.userSegment.findMany.mockRejectedValue(errToThrow);

      await expect(getUserSegments(mockEnvironmentId)).rejects.toThrow(DatabaseError);
    });

    it("Throws a generic Error for unexpected exceptions", async () => {
      const mockErrorMessage = "Mock error message";
      prismaMock.userSegment.findMany.mockRejectedValue(new Error(mockErrorMessage));

      await expect(getUserSegments(mockEnvironmentId)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for getUserSegment service", () => {
  describe("Happy Path", () => {
    it("Returns a user segment", async () => {
      const result = await getUserSegment(mockUserSegmentId);
      expect(result).toEqual(mockUserSegment);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(getUserSegment, "123");

    it("Throws a ResourceNotFoundError error if the user segment does not exist", async () => {
      prismaMock.userSegment.findUnique.mockResolvedValue(null);
      await expect(getUserSegment(mockUserSegmentId)).rejects.toThrow(ResourceNotFoundError);
    });

    it("Throws a DatabaseError error if there is a PrismaClientKnownRequestError", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: "P2002",
        clientVersion: "0.0.1",
      });

      prismaMock.userSegment.findUnique.mockRejectedValue(errToThrow);

      await expect(getUserSegment(mockUserSegmentId)).rejects.toThrow(DatabaseError);
    });

    it("Throws a generic Error for unexpected exceptions", async () => {
      const mockErrorMessage = "Mock error message";
      prismaMock.userSegment.findUnique.mockRejectedValue(new Error(mockErrorMessage));

      await expect(getUserSegment(mockUserSegmentId)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for updateUserSegment service", () => {
  describe("Happy Path", () => {
    it("Updates a user segment", async () => {
      const result = await updateUserSegment(mockUserSegmentId, mockUserSegmentUpdateInput);
      expect(result).toEqual({
        ...mockUserSegment,
        filters: getMockUserSegmentFilters("lastMonthCount", 5, "greaterEqual"),
      });
    });
  });

  describe("Sad Path", () => {
    testInputValidation(updateUserSegment, "123", {});

    it("Throws a ResourceNotFoundError error if the user segment does not exist", async () => {
      prismaMock.userSegment.findUnique.mockResolvedValue(null);
      await expect(updateUserSegment(mockUserSegmentId, mockUserSegmentCreateInput)).rejects.toThrow(
        ResourceNotFoundError
      );
    });

    it("Throws a DatabaseError error if there is a PrismaClientKnownReuestError", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: "P2002",
        clientVersion: "0.0.1",
      });

      prismaMock.userSegment.update.mockRejectedValue(errToThrow);

      await expect(updateUserSegment(mockUserSegmentId, mockUserSegmentCreateInput)).rejects.toThrow(
        DatabaseError
      );
    });

    it("Throws a generic Error for unexpected exceptions", async () => {
      const mockErrorMessage = "Mock error message";
      prismaMock.userSegment.update.mockRejectedValue(new Error(mockErrorMessage));

      await expect(updateUserSegment(mockUserSegmentId, mockUserSegmentCreateInput)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for deleteUserSegment service", () => {
  describe("Happy Path", () => {
    it("Deletes a user segment", async () => {
      prismaMock.userSegment.delete.mockResolvedValue(mockUserSegmentPrisma);
      const result = await deleteUserSegment(mockUserSegmentId);
      expect(result).toEqual(mockUserSegment);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(deleteUserSegment, "123");

    it("Throws a ResourceNotFoundError error if the user segment does not exist", async () => {
      prismaMock.userSegment.findUnique.mockResolvedValue(null);
      await expect(deleteUserSegment(mockUserSegmentId)).rejects.toThrow(ResourceNotFoundError);
    });

    it("Throws a DatabaseError error if there is a PrismaClientKnownRequestError", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: "P2002",
        clientVersion: "0.0.1",
      });

      prismaMock.userSegment.delete.mockRejectedValue(errToThrow);

      await expect(deleteUserSegment(mockUserSegmentId)).rejects.toThrow(DatabaseError);
    });

    it("Throws a generic Error for unexpected exceptions", async () => {
      const mockErrorMessage = "Mock error message";
      prismaMock.userSegment.delete.mockRejectedValue(new Error(mockErrorMessage));

      await expect(deleteUserSegment(mockUserSegmentId)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for cloneUserSegment service", () => {
  describe("Happy Path", () => {
    it("Clones a user segment", async () => {
      prismaMock.userSegment.create.mockResolvedValue({
        ...mockUserSegmentPrisma,
        title: `Copy of ${mockUserSegmentPrisma.title}`,
      });
      const result = await cloneUserSegment(mockUserSegmentId, mockSurveyId);
      expect(result).toEqual({
        ...mockUserSegment,
        title: `Copy of ${mockUserSegment.title}`,
      });
    });
  });

  describe("Sad Path", () => {
    testInputValidation(cloneUserSegment, "123", "123");

    it("Throws a ResourceNotFoundError error if the user segment does not exist", async () => {
      prismaMock.userSegment.findUnique.mockResolvedValue(null);
      await expect(cloneUserSegment(mockUserSegmentId, mockSurveyId)).rejects.toThrow(ResourceNotFoundError);
    });

    it("Throws a DatabaseError error if there is a PrismaClientKnownRequestError", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: "P2002",
        clientVersion: "0.0.1",
      });

      prismaMock.userSegment.create.mockRejectedValue(errToThrow);

      await expect(cloneUserSegment(mockUserSegmentId, mockSurveyId)).rejects.toThrow(DatabaseError);
    });

    it("Throws a generic Error for unexpected exceptions", async () => {
      const mockErrorMessage = "Mock error message";
      prismaMock.userSegment.create.mockRejectedValue(new Error(mockErrorMessage));

      await expect(cloneUserSegment(mockUserSegmentId, mockSurveyId)).rejects.toThrow(Error);
    });
  });
});
