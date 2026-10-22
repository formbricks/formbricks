import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getCreativeAttribution, getOpenedByCreativeMeta } from "./attribution";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/database", () => ({
  prisma: { creative: { findFirst: vi.fn() } },
}));

const creativeId = "clh7m1qkx0000qwer1234abcd";
const opened = { creativeId, workspaceId: "workspace-1", surveyId: "survey-1" };

describe("getCreativeAttribution", () => {
  beforeEach(() => {
    vi.mocked(prisma.creative.findFirst).mockReset();
  });

  test("attributes to a creative of the workspace whose Destination is that survey", async () => {
    vi.mocked(prisma.creative.findFirst).mockResolvedValue({ id: creativeId, name: "Feedback tab" } as never);

    expect(await getCreativeAttribution(opened)).toEqual({ id: creativeId, name: "Feedback tab" });
    // Workspace and Destination are part of the lookup, so another workspace's creative, or one that
    // opens a different survey, is never found.
    expect(prisma.creative.findFirst).toHaveBeenCalledWith({
      where: { id: creativeId, workspaceId: "workspace-1", surveyId: "survey-1" },
      select: { id: true, name: true },
    });
  });

  test("attributes to nothing when no such creative opens that survey", async () => {
    vi.mocked(prisma.creative.findFirst).mockResolvedValue(null);

    expect(await getCreativeAttribution(opened)).toBeNull();
  });

  test.each([undefined, "", "not a creative id!", 42])(
    "looks nothing up for a missing or malformed id (%s)",
    async (malformed) => {
      expect(await getCreativeAttribution({ ...opened, creativeId: malformed })).toBeNull();
      expect(prisma.creative.findFirst).not.toHaveBeenCalled();
    }
  );
});

describe("getOpenedByCreativeMeta", () => {
  beforeEach(() => {
    vi.mocked(prisma.creative.findFirst).mockReset();
  });

  test("stamps the creative's id and its current name", async () => {
    vi.mocked(prisma.creative.findFirst).mockResolvedValue({ id: creativeId, name: "Feedback tab" } as never);

    expect(await getOpenedByCreativeMeta(opened)).toEqual({
      openedByCreativeId: creativeId,
      openedByCreativeName: "Feedback tab",
    });
  });

  test("stamps nothing when the creative does not check out", async () => {
    vi.mocked(prisma.creative.findFirst).mockResolvedValue(null);

    expect(await getOpenedByCreativeMeta(opened)).toEqual({});
  });
});
