import { mockContact } from "../../response/tests/__mocks__/data.mock";
import {
  mockDisplay,
  mockDisplayInput,
  mockDisplayInputWithUserId,
  mockDisplayWithPersonId,
  mockEnvironment,
  mockEnvironmentId,
  mockSurveyId,
} from "./__mocks__/data.mock";
import { prisma } from "@/lib/__mocks__/database";
import { createDisplay } from "@/app/api/v1/client/[environmentId]/displays/lib/display";
import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { testInputValidation } from "vitestSetup";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { DatabaseError } from "@formbricks/types/errors";
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
  prisma.survey.findUnique.mockResolvedValue({
    id: mockSurveyId,
    name: "Test Survey",
    environmentId: mockEnvironmentId,
  } as any);
});

describe("Tests for createDisplay service", () => {
  describe("Happy Path", () => {
    test("Creates a new display when a userId exists", async () => {
      prisma.environment.findUnique.mockResolvedValue(mockEnvironment as any);
      prisma.display.create.mockResolvedValue(mockDisplayWithPersonId as any);

      const display = await createDisplay(mockDisplayInputWithUserId);
      expect(display).toEqual(mockDisplayWithPersonId);
    });

    test("Creates a new display when a userId does not exists", async () => {
      prisma.display.create.mockResolvedValue(mockDisplay as any);

      const display = await createDisplay(mockDisplayInput);
      expect(display).toEqual(mockDisplay);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(createDisplay, "123");

    test("Throws DatabaseError on PrismaClientKnownRequestError occurrence", async () => {
      const mockErrorMessage = "Mock error message";
      prisma.environment.findUnique.mockResolvedValue(mockEnvironment as any);
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
      prisma.display.delete.mockResolvedValue(mockDisplay as any);

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
