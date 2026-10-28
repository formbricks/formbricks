import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { findSegmentIdByTitle, getSegmentSurveyRefs, listSegmentRows } from "./service";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({
  prisma: {
    segment: { findMany: vi.fn(), findUnique: vi.fn() },
    survey: { findMany: vi.fn() },
  },
}));

const workspaceId = "clxx1234567890123456789012";
const row = (id: string, createdAt: string) => ({ id, createdAt: new Date(createdAt) });

beforeEach(() => {
  vi.resetAllMocks();
});

describe("listSegmentRows", () => {
  test("lists only the workspace's reusable segments, one row beyond the limit", async () => {
    vi.mocked(prisma.segment.findMany).mockResolvedValue([]);

    await listSegmentRows({ workspaceId, limit: 20, cursor: null, fingerprint: "fp" });

    expect(prisma.segment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId, isPrivate: false },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 21,
      })
    );
  });

  test("a cursor narrows the page without ever dropping the scope", async () => {
    vi.mocked(prisma.segment.findMany).mockResolvedValue([]);

    await listSegmentRows({
      workspaceId,
      limit: 20,
      cursor: { value: "2026-03-02T00:00:00.000Z", id: "s2" },
      fingerprint: "fp",
    });

    const createdAt = new Date("2026-03-02T00:00:00.000Z");
    expect(prisma.segment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { workspaceId, isPrivate: false },
            { OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: "s2" } }] },
          ],
        },
      })
    );
  });

  test("returns a cursor only when another row exists", async () => {
    vi.mocked(prisma.segment.findMany).mockResolvedValue([
      row("s3", "2026-03-03T00:00:00.000Z"),
      row("s2", "2026-03-02T00:00:00.000Z"),
    ] as never);

    const result = await listSegmentRows({ workspaceId, limit: 1, cursor: null, fingerprint: "fp" });

    expect(result.page).toHaveLength(1);
    expect(result.nextCursor).not.toBeNull();
  });
});

describe("getSegmentSurveyRefs", () => {
  test("reads the segment's surveys within the workspace and through the visibility clause", async () => {
    vi.mocked(prisma.survey.findMany).mockResolvedValue([]);
    const visible = { ownerId: "u_1" };

    await getSegmentSurveyRefs("s1", workspaceId, visible);

    expect(prisma.survey.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { segmentId: "s1", workspaceId, AND: [visible] },
        take: 500,
      })
    );
  });

  test("with no restriction the clause is left out", async () => {
    vi.mocked(prisma.survey.findMany).mockResolvedValue([]);

    await getSegmentSurveyRefs("s1", workspaceId, {});

    expect(prisma.survey.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { segmentId: "s1", workspaceId } })
    );
  });
});

describe("findSegmentIdByTitle", () => {
  test("looks the title up inside one workspace", async () => {
    vi.mocked(prisma.segment.findUnique).mockResolvedValue({ id: "s1" } as never);

    expect(await findSegmentIdByTitle(workspaceId, "Pro")).toBe("s1");
    expect(prisma.segment.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId_title: { workspaceId, title: "Pro" } } })
    );
  });
});
