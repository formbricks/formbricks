import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { findWorkspaceByIdOrLegacyEnvId, resolveClientApiIds } from "./resolve-client-id";

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

  test("resolves a workspaceId to workspaceId", async () => {
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

  test("falls back to legacyEnvironmentId when primary lookup fails", async () => {
    vi.mocked(prisma.workspace.findUnique)
      .mockResolvedValueOnce(null) // primary lookup fails
      .mockResolvedValueOnce({ id: "ws-456" } as any); // legacy lookup succeeds

    const result = await resolveClientApiIds("env-old-123");

    expect(result).toEqual({ workspaceId: "ws-456" });
    expect(prisma.workspace.findUnique).toHaveBeenCalledTimes(2);
    expect(prisma.workspace.findUnique).toHaveBeenNthCalledWith(1, {
      where: { id: "env-old-123" },
      select: { id: true },
    });
    expect(prisma.workspace.findUnique).toHaveBeenNthCalledWith(2, {
      where: { legacyEnvironmentId: "env-old-123" },
      select: { id: true },
    });
  });

  test("returns null when both lookups fail", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null);

    const result = await resolveClientApiIds("unknown-id");

    expect(result).toBeNull();
    expect(prisma.workspace.findUnique).toHaveBeenCalledTimes(2);
  });
});

describe("findWorkspaceByIdOrLegacyEnvId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns workspace when found by primary id", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValueOnce({ id: "ws-123" } as any);

    const result = await findWorkspaceByIdOrLegacyEnvId("ws-123");

    expect(result).toEqual({ id: "ws-123" });
    expect(prisma.workspace.findUnique).toHaveBeenCalledTimes(1);
  });

  test("returns workspace when found by legacyEnvironmentId", async () => {
    vi.mocked(prisma.workspace.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "ws-123" } as any);

    const result = await findWorkspaceByIdOrLegacyEnvId("env-old");

    expect(result).toEqual({ id: "ws-123" });
    expect(prisma.workspace.findUnique).toHaveBeenCalledTimes(2);
  });

  test("returns null when not found by either lookup", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null);

    const result = await findWorkspaceByIdOrLegacyEnvId("nonexistent");

    expect(result).toBeNull();
  });
});
