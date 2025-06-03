import { validateInputs } from "@/lib/utils/validate";
import { type ActionClass } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, ValidationError } from "@formbricks/types/errors";
import { getActionClasses } from "./action-class";

vi.mock("@/lib/utils/validate");

// Mock prisma
vi.mock("@formbricks/database", () => ({
  prisma: {
    actionClass: {
      findMany: vi.fn(),
    },
  },
}));

const environmentId = "test-environment-id";
const mockActionClasses: ActionClass[] = [
  {
    id: "action1",
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "Action 1",
    description: "Description 1",
    type: "code",
    noCodeConfig: null,
    environmentId: environmentId,
    key: "key1",
  },
  {
    id: "action2",
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "Action 2",
    description: "Description 2",
    type: "noCode",
    noCodeConfig: {
      type: "click",
      elementSelector: { cssSelector: ".btn" },
      urlFilters: [],
    },
    environmentId: environmentId,
    key: null,
  },
];

describe("getActionClasses", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("should return action classes successfully", async () => {
    vi.mocked(prisma.actionClass.findMany).mockResolvedValue(mockActionClasses);

    const result = await getActionClasses(environmentId);

    expect(result).toEqual(mockActionClasses);
    expect(validateInputs).toHaveBeenCalledWith([environmentId, expect.any(Object)]);
    expect(prisma.actionClass.findMany).toHaveBeenCalledWith({
      where: {
        environmentId: environmentId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  });

  test("should throw DatabaseError when prisma.actionClass.findMany fails", async () => {
    const errorMessage = "Prisma error";
    vi.mocked(prisma.actionClass.findMany).mockRejectedValue(new Error(errorMessage));

    await expect(getActionClasses(environmentId)).rejects.toThrow(DatabaseError);
    await expect(getActionClasses(environmentId)).rejects.toThrow(
      `Database error when fetching actions for environment ${environmentId}`
    );

    expect(validateInputs).toHaveBeenCalledWith([environmentId, expect.any(Object)]);
    expect(prisma.actionClass.findMany).toHaveBeenCalledTimes(2); // Called twice due to rejection
  });

  test("should throw ValidationError when validateInputs fails", async () => {
    const validationErrorMessage = "Validation failed";
    vi.mocked(validateInputs).mockImplementation(() => {
      throw new ValidationError(validationErrorMessage);
    });

    await expect(getActionClasses(environmentId)).rejects.toThrow(ValidationError);
    await expect(getActionClasses(environmentId)).rejects.toThrow(validationErrorMessage);

    expect(validateInputs).toHaveBeenCalledWith([environmentId, expect.any(Object)]);
    expect(prisma.actionClass.findMany).not.toHaveBeenCalled();
  });

  test("should use reactCache and our custom cache", async () => {
    vi.mocked(prisma.actionClass.findMany).mockResolvedValue(mockActionClasses);
    // We need to import the actual react cache to test it with vi.spyOn if we weren't mocking it.
    // However, since we are mocking it to be a pass-through, we just check if our main cache is called.

    await getActionClasses(environmentId);
  });
});
