import { validateInputs } from "@/lib/utils/validate";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { TDisplayCreateInput } from "@formbricks/types/displays";
import { DatabaseError, InvalidInputError, ValidationError } from "@formbricks/types/errors";
import { getContactByUserId } from "./contact";
import { createDisplay } from "./display";

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn((inputs) => inputs.map((input) => input[0])), // Pass through validation for testing
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    contact: {
      create: vi.fn(),
    },
    display: {
      create: vi.fn(),
    },
  },
}));

vi.mock("./contact", () => ({
  getContactByUserId: vi.fn(),
}));

const environmentId = "test-env-id";
const surveyId = "test-survey-id";
const userId = "test-user-id";
const contactId = "test-contact-id";
const displayId = "test-display-id";

const displayInput: TDisplayCreateInput = {
  environmentId,
  surveyId,
  userId,
};

const displayInputWithoutUserId: TDisplayCreateInput = {
  environmentId,
  surveyId,
};

const mockContact = {
  id: contactId,
  environmentId,
  userId,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockDisplay = {
  id: displayId,
  contactId,
  surveyId,
  responseId: null,
  status: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockDisplayWithoutContact = {
  id: displayId,
  contactId: null,
  surveyId,
  responseId: null,
  status: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("createDisplay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should create a display with existing contact successfully", async () => {
    vi.mocked(getContactByUserId).mockResolvedValue(mockContact);
    vi.mocked(prisma.display.create).mockResolvedValue(mockDisplay);

    const result = await createDisplay(displayInput);

    expect(validateInputs).toHaveBeenCalledWith([displayInput, expect.any(Object)]);
    expect(getContactByUserId).toHaveBeenCalledWith(environmentId, userId);
    expect(prisma.contact.create).not.toHaveBeenCalled();
    expect(prisma.display.create).toHaveBeenCalledWith({
      data: {
        survey: { connect: { id: surveyId } },
        contact: { connect: { id: contactId } },
      },
      select: { id: true, contactId: true, surveyId: true },
    });
    expect(result).toEqual(mockDisplay);
  });

  test("should create a display and new contact when contact does not exist", async () => {
    vi.mocked(getContactByUserId).mockResolvedValue(null);
    vi.mocked(prisma.contact.create).mockResolvedValue(mockContact);
    vi.mocked(prisma.display.create).mockResolvedValue(mockDisplay);

    const result = await createDisplay(displayInput);

    expect(validateInputs).toHaveBeenCalledWith([displayInput, expect.any(Object)]);
    expect(getContactByUserId).toHaveBeenCalledWith(environmentId, userId);
    expect(prisma.contact.create).toHaveBeenCalledWith({
      data: {
        environment: { connect: { id: environmentId } },
        attributes: {
          create: {
            attributeKey: {
              connect: { key_environmentId: { key: "userId", environmentId } },
            },
            value: userId,
          },
        },
      },
    });
    expect(prisma.display.create).toHaveBeenCalledWith({
      data: {
        survey: { connect: { id: surveyId } },
        contact: { connect: { id: contactId } },
      },
      select: { id: true, contactId: true, surveyId: true },
    });
    expect(result).toEqual(mockDisplay);
  });

  test("should create a display without contact when userId is not provided", async () => {
    vi.mocked(prisma.display.create).mockResolvedValue(mockDisplayWithoutContact);

    const result = await createDisplay(displayInputWithoutUserId);

    expect(validateInputs).toHaveBeenCalledWith([displayInputWithoutUserId, expect.any(Object)]);
    expect(getContactByUserId).not.toHaveBeenCalled();
    expect(prisma.contact.create).not.toHaveBeenCalled();
    expect(prisma.display.create).toHaveBeenCalledWith({
      data: {
        survey: { connect: { id: surveyId } },
      },
      select: { id: true, contactId: true, surveyId: true },
    });
    expect(result).toEqual(mockDisplayWithoutContact);
  });

  test("should throw ValidationError if validation fails", async () => {
    const validationError = new ValidationError("Validation failed");
    vi.mocked(validateInputs).mockImplementation(() => {
      throw validationError;
    });

    await expect(createDisplay(displayInput)).rejects.toThrow(ValidationError);
    expect(getContactByUserId).not.toHaveBeenCalled();
    expect(prisma.display.create).not.toHaveBeenCalled();
  });

  test("should throw InvalidInputError when survey does not exist (RelatedRecordDoesNotExist)", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Related record not found", {
      code: PrismaErrorType.RelatedRecordDoesNotExist,
      clientVersion: "2.0.0",
    });
    vi.mocked(getContactByUserId).mockResolvedValue(mockContact);
    vi.mocked(prisma.display.create).mockRejectedValue(prismaError);

    await expect(createDisplay(displayInput)).rejects.toThrow(
      new InvalidInputError(`The survey with id ${surveyId} does not exist.`)
    );
    expect(getContactByUserId).toHaveBeenCalledWith(environmentId, userId);
    expect(prisma.display.create).toHaveBeenCalled();
  });

  test("should throw DatabaseError on other Prisma known request errors", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
      code: "P2002",
      clientVersion: "2.0.0",
    });
    vi.mocked(getContactByUserId).mockResolvedValue(mockContact);
    vi.mocked(prisma.display.create).mockRejectedValue(prismaError);

    await expect(createDisplay(displayInput)).rejects.toThrow(DatabaseError);
    expect(getContactByUserId).toHaveBeenCalledWith(environmentId, userId);
    expect(prisma.display.create).toHaveBeenCalled();
  });

  test("should throw original error on other errors during display creation", async () => {
    const genericError = new Error("Something went wrong");
    vi.mocked(getContactByUserId).mockResolvedValue(mockContact);
    vi.mocked(prisma.display.create).mockRejectedValue(genericError);

    await expect(createDisplay(displayInput)).rejects.toThrow(genericError);
    expect(getContactByUserId).toHaveBeenCalledWith(environmentId, userId);
    expect(prisma.display.create).toHaveBeenCalled();
  });

  test("should throw error if getContactByUserId fails", async () => {
    const contactError = new Error("Failed to get contact");
    vi.mocked(getContactByUserId).mockRejectedValue(contactError);

    await expect(createDisplay(displayInput)).rejects.toThrow(contactError);
    expect(getContactByUserId).toHaveBeenCalledWith(environmentId, userId);
    expect(prisma.display.create).not.toHaveBeenCalled();
  });

  test("should throw error if contact creation fails", async () => {
    const contactCreateError = new Error("Failed to create contact");
    vi.mocked(getContactByUserId).mockResolvedValue(null);
    vi.mocked(prisma.contact.create).mockRejectedValue(contactCreateError);

    await expect(createDisplay(displayInput)).rejects.toThrow(contactCreateError);
    expect(getContactByUserId).toHaveBeenCalledWith(environmentId, userId);
    expect(prisma.contact.create).toHaveBeenCalled();
    expect(prisma.display.create).not.toHaveBeenCalled();
  });
});
