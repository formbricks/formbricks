import { prisma } from "../../__mocks__/database";
import { mockPerson } from "../../response/tests/__mocks__/data.mock";
import {
  mockDisplay,
  mockDisplayInput,
  mockDisplayInputWithUserId,
  mockDisplayWithPersonId,
  mockSurveyId,
} from "./__mocks__/data.mock";
import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testInputValidation } from "vitestSetup";
import { DatabaseError } from "@formbricks/types/errors";
import {
  createDisplay,
  deleteDisplay,
  getDisplay,
  getDisplayCountBySurveyId,
  getDisplaysByPersonId,
} from "../service";

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

beforeEach(() => {
  prisma.person.findFirst.mockResolvedValue(mockPerson);
});

describe("Tests for getDisplay", () => {
  describe("Happy Path", () => {
    it("Returns display associated with a given display ID", async () => {
      prisma.display.findUnique.mockResolvedValue(mockDisplay);

      const display = await getDisplay(mockDisplay.id);
      expect(display).toEqual(mockDisplay);
    });

    it("Returns all displays associated with a given person ID", async () => {
      prisma.display.findMany.mockResolvedValue([mockDisplayWithPersonId]);

      const displays = await getDisplaysByPersonId(mockPerson.id);
      expect(displays).toEqual([mockDisplayWithPersonId]);
    });

    it("Returns an empty array when no displays are found for the given person ID", async () => {
      prisma.display.findMany.mockResolvedValue([]);

      const displays = await getDisplaysByPersonId(mockPerson.id);
      expect(displays).toEqual([]);
    });

    it("Returns display count for the given survey ID", async () => {
      prisma.display.count.mockResolvedValue(1);

      const displaCount = await getDisplayCountBySurveyId(mockSurveyId);
      expect(displaCount).toEqual(1);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(getDisplaysByPersonId, "123#", 1);

    it("Throws a DatabaseError error if there is a PrismaClientKnownRequestError", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: "P2002",
        clientVersion: "0.0.1",
      });

      prisma.display.findMany.mockRejectedValue(errToThrow);

      await expect(getDisplaysByPersonId(mockPerson.id)).rejects.toThrow(DatabaseError);
    });

    it("Throws a generic Error for unexpected exceptions", async () => {
      const mockErrorMessage = "Mock error message";
      prisma.display.findMany.mockRejectedValue(new Error(mockErrorMessage));

      await expect(getDisplaysByPersonId(mockPerson.id)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for createDisplay service", () => {
  describe("Happy Path", () => {
    it("Creates a new display when a userId exists", async () => {
      prisma.display.create.mockResolvedValue(mockDisplayWithPersonId);

      const display = await createDisplay(mockDisplayInputWithUserId);
      expect(display).toEqual(mockDisplayWithPersonId);
    });

    it("Creates a new display when a userId does not exists", async () => {
      prisma.display.create.mockResolvedValue(mockDisplay);

      const display = await createDisplay(mockDisplayInput);
      expect(display).toEqual(mockDisplay);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(createDisplay, "123");

    it("Throws DatabaseError on PrismaClientKnownRequestError occurrence", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: "P2002",
        clientVersion: "0.0.1",
      });

      prisma.display.create.mockRejectedValue(errToThrow);

      await expect(createDisplay(mockDisplayInputWithUserId)).rejects.toThrow(DatabaseError);
    });

    it("Throws a generic Error for other exceptions", async () => {
      const mockErrorMessage = "Mock error message";
      prisma.display.create.mockRejectedValue(new Error(mockErrorMessage));

      await expect(createDisplay(mockDisplayInput)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for delete display service", () => {
  describe("Happy Path", () => {
    it("Deletes a display", async () => {
      prisma.display.delete.mockResolvedValue(mockDisplay);

      const display = await deleteDisplay(mockDisplay.id);
      expect(display).toEqual(mockDisplay);
    });
  });
  describe("Sad Path", () => {
    it("Throws DatabaseError on PrismaClientKnownRequestError occurrence", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: "P2002",
        clientVersion: "0.0.1",
      });

      prisma.display.delete.mockRejectedValue(errToThrow);

      await expect(deleteDisplay(mockDisplay.id)).rejects.toThrow(DatabaseError);
    });

    it("Throws a generic Error for other exceptions", async () => {
      const mockErrorMessage = "Mock error message";
      prisma.display.delete.mockRejectedValue(new Error(mockErrorMessage));

      await expect(deleteDisplay(mockDisplay.id)).rejects.toThrow(Error);
    });
  });
});
