import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { doesContactExistInWorkspace } from "./contact";

// Mock prisma
vi.mock("@formbricks/database", () => ({
  prisma: {
    contact: {
      findFirst: vi.fn(),
    },
  },
}));

// Mock react cache
vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return {
    ...actual,
    cache: vi.fn((fn: Function) => fn), // Mock react's cache to just return the function
  };
});

const contactId = "test-contact-id";
const workspaceId = "test-workspace-id";

describe("doesContactExistInWorkspace", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  test("should return true if contact exists in the workspace", async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValue({
      id: contactId,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const result = await doesContactExistInWorkspace(contactId, workspaceId);

    expect(result).toBe(true);
    expect(prisma.contact.findFirst).toHaveBeenCalledWith({
      where: { id: contactId, workspaceId },
      select: { id: true },
    });
  });

  test("should return false if contact does not exist in the workspace", async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(null);

    const result = await doesContactExistInWorkspace(contactId, workspaceId);

    expect(result).toBe(false);
    expect(prisma.contact.findFirst).toHaveBeenCalledWith({
      where: { id: contactId, workspaceId },
      select: { id: true },
    });
  });
});
