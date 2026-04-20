import { Prisma, Workspace } from "@prisma/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { getWorkspaceById } from "./workspace";

vi.mock("@/lib/utils/validate", () => ({ validateInputs: vi.fn() }));
vi.mock("@formbricks/database", () => ({ prisma: { workspace: { findUnique: vi.fn() } } }));
vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn() } }));

vi.mock("react", async () => {
  const actualReact = await vi.importActual("react");
  return {
    ...actualReact,
    cache: vi.fn((fn: (...args: any[]) => any) => fn),
  };
});

const baseWorkspace: Workspace = {
  id: "p1",
  createdAt: new Date(),
  updatedAt: new Date(),
  legacyEnvironmentId: null,
  name: "Workspace 1",
  organizationId: "org1",
  styling: { allowStyleOverwrite: true } as any,
  recontactDays: 0,
  inAppSurveyBranding: false,
  linkSurveyBranding: false,
  config: { channel: null, industry: null } as any,
  placement: "bottomRight",
  clickOutsideClose: false,
  overlay: "none",
  logo: null,
  customHeadScripts: null,
  appSetupCompleted: false,
};

describe("getWorkspaceById", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("returns workspace when found", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValueOnce(baseWorkspace);
    const result = await getWorkspaceById("ws1");
    expect(result).toEqual(baseWorkspace);
    expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
      where: { id: "ws1" },
    });
  });

  test("returns null when not found", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValueOnce(null);
    const result = await getWorkspaceById("ws1");
    expect(result).toBeNull();
  });

  test("throws DatabaseError on Prisma error", async () => {
    const error = new Prisma.PrismaClientKnownRequestError("fail", { code: "P2002", clientVersion: "1.0.0" });
    vi.mocked(prisma.workspace.findUnique).mockRejectedValueOnce(error);
    await expect(getWorkspaceById("ws1")).rejects.toThrow(DatabaseError);
  });

  test("throws unknown error", async () => {
    vi.mocked(prisma.workspace.findUnique).mockRejectedValueOnce(new Error("fail"));
    await expect(getWorkspaceById("ws1")).rejects.toThrow("fail");
  });
});
