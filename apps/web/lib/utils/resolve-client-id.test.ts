import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { resolveClientApiIds } from "./resolve-client-id";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    environment: {
      findUnique: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
    },
  },
}));

describe("resolveClientApiIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves an environmentId to environmentId + projectId", async () => {
    vi.mocked(prisma.environment.findUnique).mockResolvedValue({
      id: "env-123",
      projectId: "proj-456",
    } as any);

    const result = await resolveClientApiIds("env-123");

    expect(result).toEqual({
      environmentId: "env-123",
      projectId: "proj-456",
    });
    expect(prisma.environment.findUnique).toHaveBeenCalledWith({
      where: { id: "env-123" },
      select: { id: true, projectId: true },
    });
    expect(prisma.project.findUnique).not.toHaveBeenCalled();
  });

  it("resolves a projectId to projectId + production environmentId", async () => {
    vi.mocked(prisma.environment.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      id: "proj-456",
      environments: [{ id: "env-prod-789" }],
    } as any);

    const result = await resolveClientApiIds("proj-456");

    expect(result).toEqual({
      environmentId: "env-prod-789",
      projectId: "proj-456",
    });
    expect(prisma.project.findUnique).toHaveBeenCalledWith({
      where: { id: "proj-456" },
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

  it("returns null when neither environment nor project is found", async () => {
    vi.mocked(prisma.environment.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.project.findUnique).mockResolvedValue(null);

    const result = await resolveClientApiIds("unknown-id");

    expect(result).toBeNull();
  });

  it("returns null when project exists but has no production environment", async () => {
    vi.mocked(prisma.environment.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      id: "proj-456",
      environments: [],
    } as any);

    const result = await resolveClientApiIds("proj-456");

    expect(result).toBeNull();
  });
});
