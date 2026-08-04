import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { findWorkspaceByIdOrLegacyEnvId, resolveClientApiIds } from "./resolve-client-id";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    workspace: {
      findFirst: vi.fn(),
    },
  },
}));

describe("resolveClientApiIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("resolves a workspaceId to workspaceId", async () => {
    vi.mocked(prisma.workspace.findFirst).mockResolvedValue({
      id: "ws-456",
    } as any);

    const result = await resolveClientApiIds("ws-456");

    expect(result).toEqual({
      workspaceId: "ws-456",
    });
    expect(prisma.workspace.findFirst).toHaveBeenCalledWith({
      where: { OR: [{ id: "ws-456" }, { legacyEnvironmentId: "ws-456" }] },
      select: { id: true, organizationId: true },
    });
  });

  test("falls back to legacyEnvironmentId when primary lookup fails", async () => {
    vi.mocked(prisma.workspace.findFirst).mockResolvedValue({ id: "ws-456" } as any);

    const result = await resolveClientApiIds("env-old-123");

    expect(result).toEqual({ workspaceId: "ws-456" });
    expect(prisma.workspace.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.workspace.findFirst).toHaveBeenCalledWith({
      where: { OR: [{ id: "env-old-123" }, { legacyEnvironmentId: "env-old-123" }] },
      select: { id: true, organizationId: true },
    });
  });

  test("returns null when both lookups fail", async () => {
    vi.mocked(prisma.workspace.findFirst).mockResolvedValue(null);

    const result = await resolveClientApiIds("unknown-id");

    expect(result).toBeNull();
    expect(prisma.workspace.findFirst).toHaveBeenCalledTimes(1);
  });
});

describe("findWorkspaceByIdOrLegacyEnvId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns workspace when found by primary id", async () => {
    vi.mocked(prisma.workspace.findFirst).mockResolvedValue({ id: "ws-123" } as any);

    const result = await findWorkspaceByIdOrLegacyEnvId("ws-123");

    expect(result).toEqual({ id: "ws-123" });
    expect(prisma.workspace.findFirst).toHaveBeenCalledTimes(1);
  });

  test("returns workspace when found by legacyEnvironmentId", async () => {
    vi.mocked(prisma.workspace.findFirst).mockResolvedValue({ id: "ws-123" } as any);

    const result = await findWorkspaceByIdOrLegacyEnvId("env-old");

    expect(result).toEqual({ id: "ws-123" });
    expect(prisma.workspace.findFirst).toHaveBeenCalledTimes(1);
  });

  test("returns null when not found by either lookup", async () => {
    vi.mocked(prisma.workspace.findFirst).mockResolvedValue(null);

    const result = await findWorkspaceByIdOrLegacyEnvId("nonexistent");

    expect(result).toBeNull();
  });
});
