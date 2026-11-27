import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getContactDirectoryEmptiedOnDelete } from "./contact-directory-emptied-on-delete";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({ prisma: { workspace: { findUnique: vi.fn() } } }));

const findUnique = vi.mocked(prisma.workspace.findUnique);
const withDirectory = (workspaces: number) =>
  ({ contactDirectory: { name: "Customers", _count: { workspaces } } }) as never;

describe("getContactDirectoryEmptiedOnDelete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("names the directory when the workspace is its last one", async () => {
    findUnique.mockResolvedValue(withDirectory(1));
    expect(await getContactDirectoryEmptiedOnDelete("ws1")).toBe("Customers");
  });

  test("returns null when other workspaces still use the directory", async () => {
    findUnique.mockResolvedValue(withDirectory(2));
    expect(await getContactDirectoryEmptiedOnDelete("ws1")).toBeNull();
  });

  test("returns null for a workspace with no directory, or none at all", async () => {
    findUnique.mockResolvedValue({ contactDirectory: null } as never);
    expect(await getContactDirectoryEmptiedOnDelete("ws1")).toBeNull();
    findUnique.mockResolvedValue(null);
    expect(await getContactDirectoryEmptiedOnDelete("ws1")).toBeNull();
  });
});
