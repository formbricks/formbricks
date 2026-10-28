import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import {
  DatabaseError,
  InvalidInputError,
  ResourceNotFoundError,
  ValidationError,
} from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";
import { getCreativeAttribution } from "@/modules/ee/creatives/lib/attribution";
import { TDisplayCreateInputV2 } from "../types/display";
import { doesContactExistInWorkspace } from "./contact";
import { createDisplay } from "./display";

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn((inputs: [unknown, unknown][]) =>
    inputs.map((input: [unknown, unknown]) => input[0])
  ), // Pass through validation for testing
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
  doesContactExistInWorkspace: vi.fn(),
}));

vi.mock("@/modules/ee/creatives/lib/attribution", () => ({
  getCreativeAttribution: vi.fn(),
}));

const workspaceId = "workspace-id-mock";
const surveyId = "test-survey-id";
const contactId = "test-contact-id";
const displayId = "test-display-id";

const displayInput: TDisplayCreateInputV2 = {
  workspaceId,
  surveyId,
  contactId,
};

const displayInputWithoutContact: TDisplayCreateInputV2 = {
  workspaceId,
  surveyId,
};

const mockDisplay = {
  id: displayId,
  contactId,
  surveyId,
  responseId: null,
  creativeId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockDisplayWithoutContact = {
  id: displayId,
  contactId: null,
  surveyId,
  responseId: null,
  creativeId: null,
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
    vi.mocked(prisma.survey.findUnique).mockResolvedValue(mockSurvey);
  });

  test("should create a display with contactId successfully", async () => {
    vi.mocked(doesContactExistInWorkspace).mockResolvedValue(true);
    vi.mocked(prisma.display.create).mockResolvedValue(mockDisplay);

    const result = await createDisplay(displayInput);

    expect(validateInputs).toHaveBeenCalledWith([displayInput, expect.any(Object)]);
    expect(doesContactExistInWorkspace).toHaveBeenCalledWith(contactId, workspaceId);
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
    expect(doesContactExistInWorkspace).not.toHaveBeenCalled();
    expect(prisma.display.create).toHaveBeenCalledWith({
      data: {
        survey: { connect: { id: surveyId } },
      },
      select: { id: true, contactId: true, surveyId: true },
    });
    expect(result).toEqual(mockDisplayWithoutContact); // Changed this line
  });

  describe("opened by a creative", () => {
    const creativeId = "clh7m1qkx0000qwer1234abcd";

    test("records the creative when it is in the workspace and opens this survey", async () => {
      vi.mocked(getCreativeAttribution).mockResolvedValue({ id: creativeId, name: "Feedback tab" });
      vi.mocked(prisma.display.create).mockResolvedValue(mockDisplayWithoutContact);

      await createDisplay({ ...displayInputWithoutContact, creativeId });

      expect(getCreativeAttribution).toHaveBeenCalledWith({ creativeId, workspaceId, surveyId });
      expect(prisma.display.create).toHaveBeenCalledWith({
        data: { survey: { connect: { id: surveyId } }, creativeId },
        select: { id: true, contactId: true, surveyId: true },
      });
    });

    test("still creates the display, without the creative, when the creative does not check out", async () => {
      vi.mocked(getCreativeAttribution).mockResolvedValue(null);
      vi.mocked(prisma.display.create).mockResolvedValue(mockDisplayWithoutContact);

      const result = await createDisplay({ ...displayInputWithoutContact, creativeId });

      expect(prisma.display.create).toHaveBeenCalledWith({
        data: { survey: { connect: { id: surveyId } } },
        select: { id: true, contactId: true, surveyId: true },
      });
      expect(result).toEqual(mockDisplayWithoutContact);
    });

    test("looks no creative up when none opened the survey", async () => {
      vi.mocked(prisma.display.create).mockResolvedValue(mockDisplayWithoutContact);

      await createDisplay(displayInputWithoutContact);

      expect(getCreativeAttribution).not.toHaveBeenCalled();
    });
  });

  test("should create a display without contact if contact does not exist in the workspace", async () => {
    vi.mocked(doesContactExistInWorkspace).mockResolvedValue(false);
    vi.mocked(prisma.display.create).mockResolvedValue(mockDisplayWithoutContact); // Expect no contact connection

    const result = await createDisplay(displayInput);

    expect(validateInputs).toHaveBeenCalledWith([displayInput, expect.any(Object)]);
    expect(doesContactExistInWorkspace).toHaveBeenCalledWith(contactId, workspaceId);
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
    expect(doesContactExistInWorkspace).not.toHaveBeenCalled();
    expect(prisma.display.create).not.toHaveBeenCalled();
  });

  test("should throw InvalidInputError when survey does not exist (P2025)", async () => {
    vi.mocked(doesContactExistInWorkspace).mockResolvedValue(true);
    vi.mocked(prisma.survey.findUnique).mockResolvedValue(null);

    await expect(createDisplay(displayInput)).rejects.toThrow(new ResourceNotFoundError("Survey", surveyId));
    expect(doesContactExistInWorkspace).toHaveBeenCalledWith(contactId, workspaceId);
    expect(prisma.survey.findUnique).toHaveBeenCalledWith({
      where: { id: surveyId, workspaceId },
      select: { status: true },
    });
    expect(prisma.display.create).not.toHaveBeenCalled();
  });

  test.each(["draft", "paused", "completed"])(
    "should throw InvalidInputError when survey status is %s",
    async (status) => {
      vi.mocked(doesContactExistInWorkspace).mockResolvedValue(true);
      vi.mocked(prisma.survey.findUnique).mockResolvedValue({ ...mockSurvey, status } as any);

      await expect(createDisplay(displayInput)).rejects.toThrow(InvalidInputError);
      expect(prisma.display.create).not.toHaveBeenCalled();
    }
  );

  test("should throw DatabaseError on other Prisma known request errors", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("DB error", {
      code: "P2002",
      clientVersion: "2.0.0",
    });
    vi.mocked(doesContactExistInWorkspace).mockResolvedValue(true);
    vi.mocked(prisma.display.create).mockRejectedValue(prismaError);

    await expect(createDisplay(displayInput)).rejects.toThrow(DatabaseError);
  });

  test("should throw original error on other errors during creation", async () => {
    const genericError = new Error("Something went wrong");
    vi.mocked(doesContactExistInWorkspace).mockResolvedValue(true);
    vi.mocked(prisma.display.create).mockRejectedValue(genericError);

    await expect(createDisplay(displayInput)).rejects.toThrow(genericError);
  });

  test("should throw original error if doesContactExistInWorkspace fails", async () => {
    const contactCheckError = new Error("Failed to check contact");
    vi.mocked(doesContactExistInWorkspace).mockRejectedValue(contactCheckError);

    await expect(createDisplay(displayInput)).rejects.toThrow(contactCheckError);
    expect(prisma.display.create).not.toHaveBeenCalled();
  });
});
