import { prisma } from "../../__mocks__/database";
import { mockContact } from "../../response/tests/__mocks__/data.mock";
import {
  mockDisplay,
  mockDisplayInput,
  mockDisplayInputWithUserId,
  mockDisplayWithPersonId,
  mockEnvironment,
} from "./__mocks__/data.mock";
import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testInputValidation } from "vitestSetup";
import { DatabaseError } from "@formbricks/types/errors";
import { createDisplay } from "../../../../apps/web/app/api/v1/client/[environmentId]/displays/lib/display";
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
});

describe("Tests for createDisplay service", () => {
  describe("Happy Path", () => {
    it("Creates a new display when a userId exists", async () => {
      prisma.environment.findUnique.mockResolvedValue(mockEnvironment);
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
      prisma.environment.findUnique.mockResolvedValue(mockEnvironment);
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
