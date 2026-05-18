import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { TDisplayCreateInput } from "@formbricks/types/displays";
import {
  DatabaseError,
  InvalidInputError,
  ResourceNotFoundError,
  ValidationError,
} from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";
import { getContactByUserId } from "./contact";
import { createDisplay } from "./display";

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn((inputs: [unknown, unknown][]) =>
    inputs.map((input: [unknown, unknown]) => input[0])
  ), // Pass through validation for testing
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    contact: {
      create: vi.fn(),
    },
    display: {
      create: vi.fn(),
    },
    survey: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("./contact", () => ({
  getContactByUserId: vi.fn(),
}));

const workspaceId = "cqiu9au22kgzgqjossdlp5qh";
const surveyId = "kf4w7x11wut39ttl4j5v9ccg";
const userId = "test-user-id";
const contactId = "f9bufd72cffj19a7qj67z5fm";
const displayId = "apbycx5war0mfsyztgpwb8wr";

const displayInput: TDisplayCreateInput = {
  workspaceId,
  surveyId,
  userId,
};

const displayInputWithoutUserId: TDisplayCreateInput = {
  workspaceId,
  surveyId,
};

const mockContact = {
  id: contactId,
  workspaceId,
  userId,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockDisplay = {
  id: displayId,
  contactId,
  surveyId,
  responseId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockDisplayWithoutContact = {
  id: displayId,
  contactId: null,
  surveyId,
  responseId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockSurvey = {
  id: surveyId,
  name: "Test Survey",
  workspaceId,
  status: "inProgress",
} as any;

describe("createDisplay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateInputs).mockImplementation((inputs: [unknown, unknown][]) =>
      inputs.map((input: [unknown, unknown]) => input[0])
    );
    vi.mocked(prisma.survey.findUnique).mockResolvedValue(mockSurvey);
  });

  test("should create a display with existing contact successfully", async () => {
    vi.mocked(getContactByUserId).mockResolvedValue(mockContact);
    vi.mocked(prisma.display.create).mockResolvedValue(mockDisplay);

    const result = await createDisplay(displayInput);

    expect(validateInputs).toHaveBeenCalledWith([displayInput, expect.any(Object)]);
    expect(getContactByUserId).toHaveBeenCalledWith(workspaceId, userId);
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
    expect(getContactByUserId).toHaveBeenCalledWith(workspaceId, userId);
    expect(prisma.contact.create).toHaveBeenCalledWith({
      data: {
        workspaceId,
        attributes: {
          create: {
            attributeKey: {
              connect: { key_workspaceId: { key: "userId", workspaceId } },
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
    vi.mocked(getContactByUserId).mockResolvedValue(mockContact);
    vi.mocked(prisma.survey.findUnique).mockResolvedValue(null);

    await expect(createDisplay(displayInput)).rejects.toThrow(new ResourceNotFoundError("Survey", surveyId));
    expect(getContactByUserId).toHaveBeenCalledWith(workspaceId, userId);
    expect(prisma.survey.findUnique).toHaveBeenCalledWith({
      where: { id: surveyId, workspaceId },
    });
    expect(prisma.display.create).not.toHaveBeenCalled();
  });

  test.each(["draft", "paused", "completed"])(
    "should throw InvalidInputError when survey status is %s",
    async (status) => {
      vi.mocked(getContactByUserId).mockResolvedValue(mockContact);
      vi.mocked(prisma.survey.findUnique).mockResolvedValue({ ...mockSurvey, status } as any);

      await expect(createDisplay(displayInput)).rejects.toThrow(InvalidInputError);
      expect(prisma.display.create).not.toHaveBeenCalled();
    }
  );

  test("should throw DatabaseError on other Prisma known request errors", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
      code: "P2002",
      clientVersion: "2.0.0",
    });
    vi.mocked(getContactByUserId).mockResolvedValue(mockContact);
    vi.mocked(prisma.display.create).mockRejectedValue(prismaError);

    await expect(createDisplay(displayInput)).rejects.toThrow(DatabaseError);
    expect(getContactByUserId).toHaveBeenCalledWith(workspaceId, userId);
    expect(prisma.display.create).toHaveBeenCalled();
  });

  test("should throw original error on other errors during display creation", async () => {
    const genericError = new Error("Something went wrong");
    vi.mocked(getContactByUserId).mockResolvedValue(mockContact);
    vi.mocked(prisma.display.create).mockRejectedValue(genericError);

    await expect(createDisplay(displayInput)).rejects.toThrow(genericError);
    expect(getContactByUserId).toHaveBeenCalledWith(workspaceId, userId);
    expect(prisma.display.create).toHaveBeenCalled();
  });

  test("should throw error if getContactByUserId fails", async () => {
    const contactError = new Error("Failed to get contact");
    vi.mocked(getContactByUserId).mockRejectedValue(contactError);

    await expect(createDisplay(displayInput)).rejects.toThrow(contactError);
    expect(getContactByUserId).toHaveBeenCalledWith(workspaceId, userId);
    expect(prisma.display.create).not.toHaveBeenCalled();
  });

  test("should throw error if contact creation fails", async () => {
    const contactCreateError = new Error("Failed to create contact");
    vi.mocked(getContactByUserId).mockResolvedValue(null);
    vi.mocked(prisma.contact.create).mockRejectedValue(contactCreateError);

    await expect(createDisplay(displayInput)).rejects.toThrow(contactCreateError);
    expect(getContactByUserId).toHaveBeenCalledWith(workspaceId, userId);
    expect(prisma.contact.create).toHaveBeenCalled();
    expect(prisma.display.create).not.toHaveBeenCalled();
  });
});
