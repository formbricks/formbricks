import { mockContact } from "../../response/tests/__mocks__/data.mock";
import {
  mockDisplay,
  mockDisplayInput,
  mockDisplayInputWithUserId,
  mockDisplayWithContactId,
  mockSurveyId,
} from "./__mocks__/data.mock";
import { prisma } from "@/lib/__mocks__/database";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { DatabaseError } from "@formbricks/types/errors";
import { createDisplay } from "@/app/api/v1/client/[workspaceId]/displays/lib/display";
import { testInputValidation } from "@/vitestSetup";
import { deleteDisplay } from "../service";

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

beforeEach(() => {
  prisma.contact.findFirst.mockResolvedValue(mockContact);
  vi.mocked(prisma.survey.findUnique, { partial: true }).mockResolvedValue({
    id: mockSurveyId,
    name: "Test Survey",
    status: "inProgress",
  });
});

describe("Tests for createDisplay service", () => {
  describe("Happy Path", () => {
    test("Creates a new display when a userId exists", async () => {
      prisma.display.create.mockResolvedValue(mockDisplayWithContactId);

      const display = await createDisplay(mockDisplayInputWithUserId);
      expect(display).toEqual(mockDisplayWithContactId);
    });

    test("Creates a new display when a userId does not exists", async () => {
      prisma.display.create.mockResolvedValue(mockDisplay);

      const display = await createDisplay(mockDisplayInput);
      expect(display).toEqual(mockDisplay);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(createDisplay, "123");

    test("Throws DatabaseError on PrismaClientKnownRequestError occurrence", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: PrismaErrorType.UniqueConstraintViolation,
        clientVersion: "0.0.1",
      });

      prisma.display.create.mockRejectedValue(errToThrow);

      await expect(createDisplay(mockDisplayInputWithUserId)).rejects.toThrow(DatabaseError);
    });

    test("Throws a generic Error for other exceptions", async () => {
      const mockErrorMessage = "Mock error message";
      prisma.display.create.mockRejectedValue(new Error(mockErrorMessage));

      await expect(createDisplay(mockDisplayInput)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for delete display service", () => {
  describe("Happy Path", () => {
    test("Deletes a display", async () => {
      prisma.display.delete.mockResolvedValue(mockDisplay);

      const display = await deleteDisplay(mockDisplay.id);
      expect(display).toEqual(mockDisplay);
    });
  });
  describe("Sad Path", () => {
    test("Throws DatabaseError on PrismaClientKnownRequestError occurrence", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: PrismaErrorType.UniqueConstraintViolation,
        clientVersion: "0.0.1",
      });

      prisma.display.delete.mockRejectedValue(errToThrow);

      await expect(deleteDisplay(mockDisplay.id)).rejects.toThrow(DatabaseError);
    });

    test("Throws a generic Error for other exceptions", async () => {
      const mockErrorMessage = "Mock error message";
      prisma.display.delete.mockRejectedValue(new Error(mockErrorMessage));

      await expect(deleteDisplay(mockDisplay.id)).rejects.toThrow(Error);
    });
  });
});
