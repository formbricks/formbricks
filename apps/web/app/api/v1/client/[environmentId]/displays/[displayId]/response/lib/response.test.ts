import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, ResourceNotFoundError, ValidationError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";
import { getResponseIdByDisplayId } from "./response";

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn((inputs: [unknown, unknown][]) =>
    inputs.map((input: [unknown, unknown]) => input[0])
  ),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    display: {
      findFirst: vi.fn(),
    },
  },
}));

describe("getResponseIdByDisplayId", () => {
  const environmentId = "env1234567890123456789012";
  const displayId = "display1234567890123456789";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns the linked responseId when a response exists", async () => {
    vi.mocked(prisma.display.findFirst).mockResolvedValue({
      response: {
        id: "response123456789012345678",
      },
    } as any);

    const result = await getResponseIdByDisplayId(environmentId, displayId);

    expect(validateInputs).toHaveBeenCalledWith(
      [environmentId, expect.any(Object)],
      [displayId, expect.any(Object)]
    );
    expect(prisma.display.findFirst).toHaveBeenCalledWith({
      where: {
        id: displayId,
        survey: {
          environmentId,
        },
      },
      select: {
        response: {
          select: {
            id: true,
          },
        },
      },
    });
    expect(result).toEqual({ responseId: "response123456789012345678" });
  });

  test("returns null when the display exists but has no response", async () => {
    vi.mocked(prisma.display.findFirst).mockResolvedValue({
      response: null,
    } as any);

    await expect(getResponseIdByDisplayId(environmentId, displayId)).resolves.toEqual({
      responseId: null,
    });
  });

  test("throws ResourceNotFoundError when the display does not exist in the environment", async () => {
    vi.mocked(prisma.display.findFirst).mockResolvedValue(null);

    await expect(getResponseIdByDisplayId(environmentId, displayId)).rejects.toThrow(
      new ResourceNotFoundError("Display", displayId)
    );
  });

  test("throws ValidationError when input validation fails", async () => {
    const validationError = new ValidationError("Validation failed");
    vi.mocked(validateInputs).mockImplementation(() => {
      throw validationError;
    });

    await expect(getResponseIdByDisplayId(environmentId, displayId)).rejects.toThrow(ValidationError);
    expect(prisma.display.findFirst).not.toHaveBeenCalled();
  });

  test("throws DatabaseError on Prisma request errors", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
      code: "P2002",
      clientVersion: "test",
    });
    vi.mocked(prisma.display.findFirst).mockRejectedValue(prismaError);

    await expect(getResponseIdByDisplayId(environmentId, displayId)).rejects.toThrow(DatabaseError);
  });
});
