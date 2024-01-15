import { mockPerson } from "../../response/tests/__mocks__/data.mock";
import {
  mockDisplay,
  mockDisplayInput,
  mockDisplayInputWithUserId,
  mockDisplayLegacyInput,
  mockDisplayLegacyInputWithPersonId,
  mockDisplayLegacyUpdateInput,
  mockDisplayLegacyWithRespondedStatus,
  mockDisplayUpdate,
  mockDisplayWithPersonId,
  mockDisplayWithResponseId,
  mockResponseId,
  mockSurveyId,
} from "./__mocks__/data.mock";

import { Prisma } from "@prisma/client";

import { prismaMock } from "@formbricks/database/src/jestClient";
import { DatabaseError, ValidationError } from "@formbricks/types/errors";

import {
  createDisplay,
  createDisplayLegacy,
  deleteDisplayByResponseId,
  getDisplay,
  getDisplayCountBySurveyId,
  getDisplaysByPersonId,
  markDisplayRespondedLegacy,
  updateDisplay,
  updateDisplayLegacy,
} from "../service";

const testInputValidation = async (service: Function, ...args: any[]): Promise<void> => {
  it("it should throw a ValidationError if the inputs are invalid", async () => {
    await expect(service(...args)).rejects.toThrow(ValidationError);
  });
};

beforeEach(() => {
  prismaMock.person.findFirst.mockResolvedValue(mockPerson);
});

describe("Tests for getDisplay", () => {
  describe("Happy Path", () => {
    it("Returns display associated with a given display ID", async () => {
      prismaMock.display.findUnique.mockResolvedValue(mockDisplay);

      const display = await getDisplay(mockDisplay.id);
      expect(display).toEqual(mockDisplay);
    });

    it("Returns all displays associated with a given person ID", async () => {
      prismaMock.display.findMany.mockResolvedValue([mockDisplayWithPersonId]);

      const displays = await getDisplaysByPersonId(mockPerson.id);
      expect(displays).toEqual([mockDisplayWithPersonId]);
    });

    it("Returns an empty array when no displays are found for the given person ID", async () => {
      prismaMock.display.findMany.mockResolvedValue([]);

      const displays = await getDisplaysByPersonId(mockPerson.id);
      expect(displays).toEqual([]);
    });

    it("Returns display count for the given survey ID", async () => {
      prismaMock.display.count.mockResolvedValue(1);

      const displaCount = await getDisplayCountBySurveyId(mockSurveyId);
      expect(displaCount).toEqual(1);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(getDisplaysByPersonId, "123", 1);

    it("Throws a DatabaseError error if there is a PrismaClientKnownRequestError", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: "P2002",
        clientVersion: "0.0.1",
      });

      prismaMock.display.findMany.mockRejectedValue(errToThrow);

      await expect(getDisplaysByPersonId(mockPerson.id)).rejects.toThrow(DatabaseError);
    });

    it("Throws a generic Error for unexpected exceptions", async () => {
      const mockErrorMessage = "Mock error message";
      prismaMock.display.findMany.mockRejectedValue(new Error(mockErrorMessage));

      await expect(getDisplaysByPersonId(mockPerson.id)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for createDisplay service", () => {
  describe("Happy Path", () => {
    it("Creates a new display when a userId exists", async () => {
      prismaMock.display.create.mockResolvedValue(mockDisplayWithPersonId);

      const display = await createDisplay(mockDisplayInputWithUserId);
      expect(display).toEqual(mockDisplayWithPersonId);
    });

    it("Creates a new display when a userId does not exists", async () => {
      prismaMock.display.create.mockResolvedValue(mockDisplay);

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

      prismaMock.display.create.mockRejectedValue(errToThrow);

      await expect(createDisplay(mockDisplayInputWithUserId)).rejects.toThrow(DatabaseError);
    });

    it("Throws a generic Error for other exceptions", async () => {
      const mockErrorMessage = "Mock error message";
      prismaMock.display.create.mockRejectedValue(new Error(mockErrorMessage));

      await expect(createDisplay(mockDisplayInput)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for updateDisplay Service", () => {
  describe("Happy Path", () => {
    it("Updates a display (responded)", async () => {
      prismaMock.display.update.mockResolvedValue(mockDisplayWithResponseId);

      const display = await updateDisplay(mockDisplay.id, mockDisplayUpdate);
      expect(display).toEqual(mockDisplayWithResponseId);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(updateDisplay, "123", "123");

    it("Throws DatabaseError on PrismaClientKnownRequestError", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: "P2002",
        clientVersion: "0.0.1",
      });

      prismaMock.display.update.mockRejectedValue(errToThrow);

      await expect(updateDisplay(mockDisplay.id, mockDisplayUpdate)).rejects.toThrow(DatabaseError);
    });

    it("Throws a generic Error for other unexpected issues", async () => {
      const mockErrorMessage = "Mock error message";
      prismaMock.display.update.mockRejectedValue(new Error(mockErrorMessage));

      await expect(updateDisplay(mockDisplay.id, mockDisplayUpdate)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for createDisplayLegacy service", () => {
  describe("Happy Path", () => {
    it("Creates a display when a person ID exist", async () => {
      prismaMock.display.create.mockResolvedValue(mockDisplayWithPersonId);

      const display = await createDisplayLegacy(mockDisplayLegacyInputWithPersonId);
      expect(display).toEqual(mockDisplayWithPersonId);
    });
    it("Creates a display when a person ID does not exist", async () => {
      prismaMock.display.create.mockResolvedValue(mockDisplay);

      const display = await createDisplayLegacy(mockDisplayLegacyInput);
      expect(display).toEqual(mockDisplay);
    });
  });
  describe("Sad Path", () => {
    testInputValidation(createDisplayLegacy, "123");

    it("Throws DatabaseError on PrismaClientKnownRequestError occurrence", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: "P2002",
        clientVersion: "0.0.1",
      });

      prismaMock.display.create.mockRejectedValue(errToThrow);

      await expect(createDisplayLegacy(mockDisplayLegacyInputWithPersonId)).rejects.toThrow(DatabaseError);
    });

    it("Throws a generic Error for other exceptions", async () => {
      const mockErrorMessage = "Mock error message";
      prismaMock.display.create.mockRejectedValue(new Error(mockErrorMessage));

      await expect(createDisplayLegacy(mockDisplayLegacyInputWithPersonId)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for updateDisplayLegacy Service", () => {
  describe("Happy Path", () => {
    it("Updates a display", async () => {
      prismaMock.display.update.mockResolvedValue(mockDisplayWithPersonId);

      const display = await updateDisplayLegacy(mockDisplay.id, mockDisplayLegacyUpdateInput);
      expect(display).toEqual(mockDisplayWithPersonId);
    });

    it("marks display as responded legacy", async () => {
      prismaMock.display.update.mockResolvedValue(mockDisplayLegacyWithRespondedStatus);

      const display = await markDisplayRespondedLegacy(mockDisplay.id);
      expect(display).toEqual(mockDisplayLegacyWithRespondedStatus);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(updateDisplayLegacy, "123", "123");

    it("Throws DatabaseError on PrismaClientKnownRequestError", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: "P2002",
        clientVersion: "0.0.1",
      });

      prismaMock.display.update.mockRejectedValue(errToThrow);

      await expect(updateDisplayLegacy(mockDisplay.id, mockDisplayLegacyUpdateInput)).rejects.toThrow(
        DatabaseError
      );
    });

    it("Throws a generic Error for other unexpected issues", async () => {
      const mockErrorMessage = "Mock error message";
      prismaMock.display.update.mockRejectedValue(new Error(mockErrorMessage));

      await expect(updateDisplayLegacy(mockDisplay.id, mockDisplayLegacyUpdateInput)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for deleteDisplayByResponseId service", () => {
  describe("Happy Path", () => {
    it("Deletes a display when a response associated to it is deleted", async () => {
      prismaMock.display.delete.mockResolvedValue(mockDisplayWithResponseId);

      const display = await deleteDisplayByResponseId(mockResponseId, mockSurveyId);
      expect(display).toEqual(mockDisplayWithResponseId);
    });
  });
  describe("Sad Path", () => {
    testInputValidation(createDisplayLegacy, "123");

    it("Throws DatabaseError on PrismaClientKnownRequestError occurrence", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: "P2002",
        clientVersion: "0.0.1",
      });

      prismaMock.display.delete.mockRejectedValue(errToThrow);

      await expect(deleteDisplayByResponseId(mockResponseId, mockSurveyId)).rejects.toThrow(DatabaseError);
    });

    it("Throws a generic Error for other exceptions", async () => {
      const mockErrorMessage = "Mock error message";
      prismaMock.display.delete.mockRejectedValue(new Error(mockErrorMessage));

      await expect(deleteDisplayByResponseId(mockResponseId, mockSurveyId)).rejects.toThrow(Error);
    });
  });
});
