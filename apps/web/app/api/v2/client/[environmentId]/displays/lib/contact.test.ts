import { cache } from "@/lib/cache";
import { contactCache } from "@/lib/cache/contact";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
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

// Mock cache module
vi.mock("@/lib/cache");
vi.mock("@/lib/cache/contact", () => ({
  contactCache: {
    tag: {
      byId: vi.fn((id) => `contact-${id}`),
    },
  },
}));

// Mock react cache
vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return {
    ...actual,
    cache: vi.fn((fn) => fn), // Mock react's cache to just return the function
  };
});

const contactId = "test-contact-id";

describe("doesContactExist", () => {
  beforeEach(() => {
    vi.mocked(cache).mockImplementation((fn) => async () => {
      return fn();
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test("should return true if contact exists", async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValue({ id: contactId });

    const result = await doesContactExist(contactId);

    expect(result).toBe(true);
    expect(prisma.contact.findFirst).toHaveBeenCalledWith({
      where: { id: contactId },
      select: { id: true },
    });
    expect(cache).toHaveBeenCalledWith(expect.any(Function), [`doesContactExistDisplaysApiV2-${contactId}`], {
      tags: [contactCache.tag.byId(contactId)],
    });
  });

  test("should return false if contact does not exist", async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(null);

    const result = await doesContactExist(contactId);

    expect(result).toBe(false);
    expect(prisma.contact.findFirst).toHaveBeenCalledWith({
      where: { id: contactId },
      select: { id: true },
    });
    expect(cache).toHaveBeenCalledWith(expect.any(Function), [`doesContactExistDisplaysApiV2-${contactId}`], {
      tags: [contactCache.tag.byId(contactId)],
    });
  });
});
