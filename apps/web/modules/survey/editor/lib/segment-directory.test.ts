import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getOtherDirectorySegmentId } from "./segment-directory";

vi.mock("@formbricks/database", () => ({
  prisma: { survey: { findUnique: vi.fn() } },
}));

type TSurveyRow = Awaited<ReturnType<typeof prisma.survey.findUnique>>;

const mockSurvey = (
  segment: { id: string; directoryId: string | null } | null,
  contactDirectoryId: string | null
) =>
  vi
    .mocked(prisma.survey.findUnique)
    .mockResolvedValue({ segment, workspace: { contactDirectoryId } } as unknown as TSurveyRow);

describe("getOtherDirectorySegmentId", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("is null for a segment from the workspace's current directory", async () => {
    mockSurvey({ id: "seg1", directoryId: "dir-a" }, "dir-a");

    await expect(getOtherDirectorySegmentId("survey1")).resolves.toBeNull();
  });

  test("names the segment when it is from another directory", async () => {
    mockSurvey({ id: "seg1", directoryId: "dir-old" }, "dir-new");

    await expect(getOtherDirectorySegmentId("survey1")).resolves.toBe("seg1");
  });

  test("names the segment when the workspace has no directory", async () => {
    mockSurvey({ id: "seg1", directoryId: "dir-old" }, null);

    await expect(getOtherDirectorySegmentId("survey1")).resolves.toBe("seg1");
  });

  test("is null for a survey without a segment", async () => {
    mockSurvey(null, null);

    await expect(getOtherDirectorySegmentId("survey1")).resolves.toBeNull();
  });
});
