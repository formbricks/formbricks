import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { resolveClientApiIds } from "./resolve-client-id";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    workspace: {
      findUnique: vi.fn(),
    },
  },
}));

describe("resolveClientApiIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves a workspaceId to workspaceId", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
      id: "ws-456",
    } as any);

    const result = await resolveClientApiIds("ws-456");

    expect(result).toEqual({
      workspaceId: "ws-456",
    });
    expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
      where: { id: "ws-456" },
      select: { id: true },
    });
  });

  it("returns null when workspace is not found", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null);

    const result = await resolveClientApiIds("unknown-id");

    expect(result).toBeNull();
  });
});
