import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { resolveClientApiIds } from "./resolve-client-id";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    environment: {
      findUnique: vi.fn(),
    },
    workspace: {
      findUnique: vi.fn(),
    },
  },
}));

describe("resolveClientApiIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves an environmentId to environmentId + workspaceId", async () => {
    vi.mocked(prisma.environment.findUnique).mockResolvedValue({
      id: "env-123",
      workspaceId: "ws-456",
    } as any);
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null);

    const result = await resolveClientApiIds("env-123");

    expect(result).toEqual({
      environmentId: "env-123",
      workspaceId: "ws-456",
    });
    expect(prisma.environment.findUnique).toHaveBeenCalledWith({
      where: { id: "env-123" },
      select: { id: true, workspaceId: true },
    });
    // Both queries run in parallel
    expect(prisma.workspace.findUnique).toHaveBeenCalled();
  });

  it("resolves a workspaceId to workspaceId + production environmentId", async () => {
    vi.mocked(prisma.environment.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
      id: "ws-456",
      environments: [{ id: "env-prod-789" }],
    } as any);

    const result = await resolveClientApiIds("ws-456");

    expect(result).toEqual({
      environmentId: "env-prod-789",
      workspaceId: "ws-456",
    });
    expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
      where: { id: "ws-456" },
      select: {
        id: true,
        environments: {
          where: { type: "production" },
          select: { id: true },
          take: 1,
        },
      },
    });
  });

  it("returns null when neither environment nor workspace is found", async () => {
    vi.mocked(prisma.environment.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null);

    const result = await resolveClientApiIds("unknown-id");

    expect(result).toBeNull();
  });

  it("returns null when workspace exists but has no production environment", async () => {
    vi.mocked(prisma.environment.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
      id: "ws-456",
      environments: [],
    } as any);

    const result = await resolveClientApiIds("ws-456");

    expect(result).toBeNull();
  });
});
