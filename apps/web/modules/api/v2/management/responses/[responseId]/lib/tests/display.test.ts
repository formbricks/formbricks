import { displayId, mockDisplay } from "./__mocks__/display.mock";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/src/types/error";
import { deleteDisplay } from "../display";

vi.mock("@formbricks/database", () => ({
  prisma: {
    display: {
      delete: vi.fn(),
    },
  },
}));

describe("Display Lib", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("delete the display successfully ", async () => {
    vi.mocked(prisma.display.delete).mockResolvedValue(mockDisplay);

    const result = await deleteDisplay(mockDisplay.id);
    expect(prisma.display.delete).toHaveBeenCalledWith({
      where: { id: mockDisplay.id },
      select: {
        id: true,
        contactId: true,
        surveyId: true,
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(true);
    }
  });

  test("return a not_found error when the display is not found", async () => {
    vi.mocked(prisma.display.delete).mockRejectedValue(
      new PrismaClientKnownRequestError("Display not found", {
        code: PrismaErrorType.RelatedRecordDoesNotExist,
        clientVersion: "1.0.0",
        meta: {
          cause: "Display not found",
        },
      })
    );

    const result = await deleteDisplay(mockDisplay.id);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({
        type: "not_found",
        details: [{ field: "display", issue: "not found" }],
      });
    }
  });

  test("return an internal_server_error when prisma.display.delete throws", async () => {
    vi.mocked(prisma.display.delete).mockRejectedValue(new Error("Delete error"));

    const result = await deleteDisplay(displayId);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({
        type: "internal_server_error",
        details: [{ field: "display", issue: "Delete error" }],
      });
    }
  });
});
