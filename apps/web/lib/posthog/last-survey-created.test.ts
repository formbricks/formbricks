import { describe, expect, test, vi } from "vitest";
import { DatabaseError, UnknownError } from "@formbricks/types/errors";
import { getLastSurveyCreatedAtPersonProperty } from "./last-survey-created";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  findManyMembership: vi.fn(),
  findFirstSurvey: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    membership: { findMany: mocks.findManyMembership },
    survey: { findFirst: mocks.findFirstSurvey },
  },
}));

describe("getLastSurveyCreatedAtPersonProperty", () => {
  test("returns null when the user has no memberships", async () => {
    mocks.findManyMembership.mockResolvedValueOnce([]);

    const result = await getLastSurveyCreatedAtPersonProperty("user-1");

    expect(result).toEqual({ last_survey_created_at: null });
    expect(mocks.findFirstSurvey).not.toHaveBeenCalled();
  });

  test("returns null when none of the user's organizations have created a survey", async () => {
    mocks.findManyMembership.mockResolvedValueOnce([{ organizationId: "org-1" }]);
    mocks.findFirstSurvey.mockResolvedValueOnce(null);

    const result = await getLastSurveyCreatedAtPersonProperty("user-1");

    expect(result).toEqual({ last_survey_created_at: null });
  });

  test("returns the latest survey createdAt across every organization the user belongs to, not just one", async () => {
    mocks.findManyMembership.mockResolvedValueOnce([
      { organizationId: "org-1" },
      { organizationId: "org-2" },
    ]);
    const createdAt = new Date("2026-08-20T12:00:00.000Z");
    mocks.findFirstSurvey.mockResolvedValueOnce({ createdAt });

    const result = await getLastSurveyCreatedAtPersonProperty("user-1");

    expect(result).toEqual({ last_survey_created_at: createdAt.toISOString() });
    expect(mocks.findFirstSurvey).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspace: { organizationId: { in: ["org-1", "org-2"] } } },
        orderBy: { createdAt: "desc" },
      })
    );
  });

  test("wraps a Prisma error in DatabaseError", async () => {
    const { Prisma } = await import("@formbricks/database/prisma");
    mocks.findManyMembership.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("boom", { code: "P2002", clientVersion: "0.0.0" })
    );

    await expect(getLastSurveyCreatedAtPersonProperty("user-1")).rejects.toThrow(DatabaseError);
  });

  test("wraps a non-Prisma error in UnknownError", async () => {
    mocks.findManyMembership.mockRejectedValueOnce(new Error("boom"));

    await expect(getLastSurveyCreatedAtPersonProperty("user-1")).rejects.toThrow(UnknownError);
  });
});
