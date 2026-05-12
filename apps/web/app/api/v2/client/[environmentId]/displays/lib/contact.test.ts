import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { doesContactExist } from "./contact";

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
const environmentId = "test-env-id";

describe("doesContactExist", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  test("should return true if contact exists", async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValue({
      id: contactId,
      createdAt: new Date(),
      updatedAt: new Date(),
      environmentId: "test-env",
    });

    const result = await doesContactExist(contactId, environmentId);

    expect(result).toBe(true);
    expect(prisma.contact.findFirst).toHaveBeenCalledWith({
      where: { id: contactId, environmentId },
      select: { id: true },
    });
  });

  test("should return false if contact does not exist in the environment", async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(null);

    const result = await doesContactExist(contactId, environmentId);

    expect(result).toBe(false);
    expect(prisma.contact.findFirst).toHaveBeenCalledWith({
      where: { id: contactId, environmentId },
      select: { id: true },
    });
  });
});
