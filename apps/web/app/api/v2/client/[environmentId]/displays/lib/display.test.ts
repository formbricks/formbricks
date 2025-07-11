import { validateInputs } from "@/lib/utils/validate";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, InvalidInputError, ValidationError } from "@formbricks/types/errors";
import { TDisplayCreateInputV2 } from "../types/display";
import { doesContactExist } from "./contact";
import { createDisplay } from "./display";

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn((inputs) => inputs.map((input) => input[0])), // Pass through validation for testing
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    display: {
      create: vi.fn(),
    },
    survey: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("./contact", () => ({
  doesContactExist: vi.fn(),
}));

const environmentId = "test-env-id";
const surveyId = "test-survey-id";
const contactId = "test-contact-id";
const displayId = "test-display-id";

const displayInput: TDisplayCreateInputV2 = {
  environmentId,
  surveyId,
  contactId,
};

const displayInputWithoutContact: TDisplayCreateInputV2 = {
  environmentId,
  surveyId,
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

const mockSurvey = {
  id: surveyId,
  name: "Test Survey",
  environmentId,
} as any;

describe("createDisplay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.survey.findUnique).mockResolvedValue(mockSurvey);
  });

  test("should create a display with contactId successfully", async () => {
    vi.mocked(doesContactExist).mockResolvedValue(true);
    vi.mocked(prisma.display.create).mockResolvedValue(mockDisplay);

    const result = await createDisplay(displayInput);

    expect(validateInputs).toHaveBeenCalledWith([displayInput, expect.any(Object)]);
    expect(doesContactExist).toHaveBeenCalledWith(contactId);
    expect(prisma.display.create).toHaveBeenCalledWith({
      data: {
        survey: { connect: { id: surveyId } },
        contact: { connect: { id: contactId } },
      },
      select: { id: true, contactId: true, surveyId: true },
    });
    expect(result).toEqual(mockDisplay); // Changed this line
  });

  test("should create a display without contactId successfully", async () => {
    vi.mocked(prisma.display.create).mockResolvedValue(mockDisplayWithoutContact);

    const result = await createDisplay(displayInputWithoutContact);

    expect(validateInputs).toHaveBeenCalledWith([displayInputWithoutContact, expect.any(Object)]);
    expect(doesContactExist).not.toHaveBeenCalled();
    expect(prisma.display.create).toHaveBeenCalledWith({
      data: {
        survey: { connect: { id: surveyId } },
      },
      select: { id: true, contactId: true, surveyId: true },
    });
    expect(result).toEqual(mockDisplayWithoutContact); // Changed this line
  });

  test("should create a display even if contact does not exist", async () => {
    vi.mocked(doesContactExist).mockResolvedValue(false);
    vi.mocked(prisma.display.create).mockResolvedValue(mockDisplayWithoutContact); // Expect no contact connection

    const result = await createDisplay(displayInput);

    expect(validateInputs).toHaveBeenCalledWith([displayInput, expect.any(Object)]);
    expect(doesContactExist).toHaveBeenCalledWith(contactId);
    expect(prisma.display.create).toHaveBeenCalledWith({
      data: {
        survey: { connect: { id: surveyId } },
        // No contact connection expected here
      },
      select: { id: true, contactId: true, surveyId: true },
    });
    expect(result).toEqual(mockDisplayWithoutContact); // Changed this line
  });

  test("should throw ValidationError if validation fails", async () => {
    const validationError = new ValidationError("Validation failed");
    vi.mocked(validateInputs).mockImplementation(() => {
      throw validationError;
    });

    await expect(createDisplay(displayInput)).rejects.toThrow(ValidationError);
    expect(doesContactExist).not.toHaveBeenCalled();
    expect(prisma.display.create).not.toHaveBeenCalled();
  });

  test("should throw InvalidInputError when survey does not exist (P2025)", async () => {
    vi.mocked(doesContactExist).mockResolvedValue(true);
    vi.mocked(prisma.survey.findUnique).mockResolvedValue(null);

    await expect(createDisplay(displayInput)).rejects.toThrow(
      new InvalidInputError(
        `The survey with id ${surveyId} and environmentId ${environmentId} does not exist.`
      )
    );
    expect(doesContactExist).toHaveBeenCalledWith(contactId);
    expect(prisma.survey.findUnique).toHaveBeenCalledWith({
      where: { id: surveyId, environmentId },
    });
    expect(prisma.display.create).not.toHaveBeenCalled();
  });

  test("should throw DatabaseError on other Prisma known request errors", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("DB error", {
      code: "P2002",
      clientVersion: "2.0.0",
    });
    vi.mocked(doesContactExist).mockResolvedValue(true);
    vi.mocked(prisma.display.create).mockRejectedValue(prismaError);

    await expect(createDisplay(displayInput)).rejects.toThrow(DatabaseError);
  });

  test("should throw original error on other errors during creation", async () => {
    const genericError = new Error("Something went wrong");
    vi.mocked(doesContactExist).mockResolvedValue(true);
    vi.mocked(prisma.display.create).mockRejectedValue(genericError);

    await expect(createDisplay(displayInput)).rejects.toThrow(genericError);
  });

  test("should throw original error if doesContactExist fails", async () => {
    const contactCheckError = new Error("Failed to check contact");
    vi.mocked(doesContactExist).mockRejectedValue(contactCheckError);

    await expect(createDisplay(displayInput)).rejects.toThrow(contactCheckError);
    expect(prisma.display.create).not.toHaveBeenCalled();
  });
});
