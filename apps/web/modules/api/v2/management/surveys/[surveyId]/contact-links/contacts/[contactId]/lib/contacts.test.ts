import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getContact } from "./contacts";

vi.mock("@formbricks/database", () => ({
  prisma: {
    contact: {
      findUnique: vi.fn(),
    },
  },
}));

describe("getContact", () => {
  const mockContactId = "cm8fj8ry6000008l5daam88nc";
  const mockWorkspaceId = "cm8fj8xt3000108l5art7594h";
  const mockContact = {
    id: mockContactId,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Any contact of the survey workspace's contact directory, whichever workspace created it.
  test("returns the contact when it is in the workspace's directory", async () => {
    vi.mocked(prisma.contact.findUnique).mockResolvedValue(
      mockContact as Awaited<ReturnType<typeof prisma.contact.findUnique>>
    );

    const result = await getContact(mockContactId, mockWorkspaceId);

    expect(prisma.contact.findUnique).toHaveBeenCalledWith({
      where: {
        id: mockContactId,
        directory: { workspaces: { some: { id: mockWorkspaceId } } },
      },
      select: {
        id: true,
      },
    });
    if (result.ok) {
      expect(result.data).toEqual(mockContact);
    }
  });

  test("returns null when contact not found", async () => {
    vi.mocked(prisma.contact.findUnique).mockResolvedValue(null);

    const result = await getContact(mockContactId, mockWorkspaceId);

    expect(prisma.contact.findUnique).toHaveBeenCalled();
    if (!result.ok) {
      expect(result.error).toEqual({
        details: [
          {
            field: "contact",
            issue: "not found",
          },
        ],
        type: "not_found",
      });
    }
  });
});
