import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { handleApiError } from "@/app/lib/api/handle-api-error";
import {
  CONTACT_DIRECTORY_MISSING_MESSAGE,
  ContactDirectoryMissingError,
  getReportingWorkspaceByDirectory,
  getWorkspaceContactDirectory,
  getWorkspacesOnDirectory,
  requireWorkspaceContactDirectory,
  whereContactsOfWorkspace,
} from "./contact-directory";

vi.mock("@formbricks/database", () => ({
  prisma: { workspace: { findUnique: vi.fn(), findMany: vi.fn() } },
}));
vi.mock("react", () => ({ cache: <T>(fn: T) => fn }));

const workspaceId = "clws00000000000000000001";

describe("getWorkspaceContactDirectory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns the id and matching key of the workspace's directory", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
      contactDirectory: { id: "dir-1", matchingKey: "email" },
    } as never);

    await expect(getWorkspaceContactDirectory(workspaceId)).resolves.toEqual({
      id: "dir-1",
      matchingKey: "email",
    });
    expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
      where: { id: workspaceId },
      select: { contactDirectory: { select: { id: true, matchingKey: true } } },
    });
  });

  test("returns null for a workspace with no directory", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({ contactDirectory: null } as never);

    await expect(getWorkspaceContactDirectory(workspaceId)).resolves.toBeNull();
  });

  test("returns null for a workspace that does not exist", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null);

    await expect(getWorkspaceContactDirectory(workspaceId)).resolves.toBeNull();
  });
});

describe("requireWorkspaceContactDirectory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns the directory when the workspace has one", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
      contactDirectory: { id: "dir-1", matchingKey: "externalId" },
    } as never);

    await expect(requireWorkspaceContactDirectory(workspaceId)).resolves.toEqual({
      id: "dir-1",
      matchingKey: "externalId",
    });
  });

  test("throws the no-directory error for a workspace with no directory", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({ contactDirectory: null } as never);

    await expect(requireWorkspaceContactDirectory(workspaceId)).rejects.toThrow(ContactDirectoryMissingError);
  });
});

describe("ContactDirectoryMissingError", () => {
  test("carries the decision 13 message", () => {
    expect(new ContactDirectoryMissingError().message).toBe(
      "A contact directory needs to be set up for this workspace before contacts are available. Ask an organization owner or manager to assign one."
    );
    expect(CONTACT_DIRECTORY_MISSING_MESSAGE).toBe(new ContactDirectoryMissingError().message);
  });

  test("answers 403 with its message through the shared v1 error boundary", async () => {
    const { response, error } = handleApiError(new ContactDirectoryMissingError(), { cors: true });

    expect(response.status).toBe(403);
    expect(error).toBeUndefined();
    await expect(response.json()).resolves.toMatchObject({
      code: "forbidden",
      message: CONTACT_DIRECTORY_MISSING_MESSAGE,
    });
  });
});

describe("whereContactsOfWorkspace", () => {
  // In a shared directory a contact keeps the workspace it was created from, so the filter goes through
  // the workspace's directory and never through the contact's own workspaceId.
  test("matches the contacts of the workspace's directory and spreads into a wider filter", () => {
    expect({ id: "contact-1", ...whereContactsOfWorkspace(workspaceId) }).toEqual({
      id: "contact-1",
      directory: { workspaces: { some: { id: workspaceId } } },
    });
  });
});

describe("getReportingWorkspaceByDirectory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("maps each directory to the lowest workspace id on it, whatever order the ids come in", async () => {
    vi.mocked(prisma.workspace.findMany).mockResolvedValue([
      { id: "ws-a", contactDirectoryId: "dir-1" },
      { id: "ws-b", contactDirectoryId: "dir-1" },
      { id: "ws-c", contactDirectoryId: "dir-2" },
    ] as never);

    const result = await getReportingWorkspaceByDirectory(["ws-c", "ws-b", "ws-a"]);

    expect(prisma.workspace.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["ws-c", "ws-b", "ws-a"] }, contactDirectoryId: { not: null } },
      select: { id: true, contactDirectoryId: true },
      orderBy: { id: "asc" },
    });
    expect([...result.entries()]).toEqual([
      ["dir-1", "ws-a"],
      ["dir-2", "ws-c"],
    ]);
  });

  test("returns an empty map without a query for no workspaces", async () => {
    expect((await getReportingWorkspaceByDirectory([])).size).toBe(0);
    expect(prisma.workspace.findMany).not.toHaveBeenCalled();
  });
});

describe("getWorkspacesOnDirectory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns the given workspaces that use the directory, lowest id first", async () => {
    vi.mocked(prisma.workspace.findMany).mockResolvedValue([{ id: "ws-a" }, { id: "ws-b" }] as never);

    await expect(getWorkspacesOnDirectory("dir-1", ["ws-b", "ws-a", "ws-x"])).resolves.toEqual([
      "ws-a",
      "ws-b",
    ]);
    expect(prisma.workspace.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["ws-b", "ws-a", "ws-x"] }, contactDirectoryId: "dir-1" },
      select: { id: true },
      orderBy: { id: "asc" },
    });
  });

  test("returns nothing without a query for no workspaces", async () => {
    await expect(getWorkspacesOnDirectory("dir-1", [])).resolves.toEqual([]);
    expect(prisma.workspace.findMany).not.toHaveBeenCalled();
  });
});
