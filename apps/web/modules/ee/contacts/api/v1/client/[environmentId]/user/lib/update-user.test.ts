import { updateAttributes } from "@/modules/ee/contacts/lib/attributes";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { getPersonSegmentIds } from "./segments";
import { updateUser } from "./update-user";

// Mock the cache functions
vi.mock("@/modules/cache/lib/withCache", () => ({
  withCache: vi.fn((fn) => fn), // Just execute the function without caching for tests
}));

vi.mock("@/modules/ee/contacts/lib/attributes", () => ({
  updateAttributes: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    environment: {
      findUnique: vi.fn(),
    },
    contact: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("./segments", () => ({
  getPersonSegmentIds: vi.fn(),
}));

const mockEnvironmentId = "test-environment-id";
const mockUserId = "test-user-id";
const mockContactId = "test-contact-id";

const mockContactData = {
  id: mockContactId,
  attributes: [
    { attributeKey: { key: "userId" }, value: mockUserId },
    { attributeKey: { key: "email" }, value: "test@example.com" },
  ],
  responses: [],
  displays: [],
};

describe("updateUser", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Mock environment lookup (cached) - just provide what's needed
    vi.mocked(prisma.environment.findUnique).mockResolvedValue({
      id: mockEnvironmentId,
      type: "production",
    } as any);
    // Mock successful attribute updates
    vi.mocked(updateAttributes).mockResolvedValue({ success: true, messages: [] });
    // Mock segments
    vi.mocked(getPersonSegmentIds).mockResolvedValue(["segment1"]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("should throw ResourceNotFoundError if environment is not found", async () => {
    vi.mocked(prisma.environment.findUnique).mockResolvedValue(null);
    await expect(updateUser(mockEnvironmentId, mockUserId, "desktop")).rejects.toThrow(
      new ResourceNotFoundError("environment", mockEnvironmentId)
    );
  });

  test("should create a new contact if not found", async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.contact.create).mockResolvedValue(mockContactData as any);

    const result = await updateUser(mockEnvironmentId, mockUserId, "desktop");

    expect(prisma.contact.create).toHaveBeenCalledWith({
      data: {
        environment: { connect: { id: mockEnvironmentId } },
        attributes: {
          create: [
            {
              attributeKey: {
                connect: { key_environmentId: { key: "userId", environmentId: mockEnvironmentId } },
              },
              value: mockUserId,
            },
          ],
        },
      },
      select: {
        id: true,
        attributes: {
          select: {
            attributeKey: { select: { key: true } },
            value: true,
          },
        },
        responses: {
          select: { surveyId: true },
        },
        displays: {
          select: {
            surveyId: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    expect(result.state.data).toEqual(
      expect.objectContaining({
        contactId: mockContactId,
        userId: mockUserId,
        segments: ["segment1"],
        displays: [],
        responses: [],
        lastDisplayAt: null,
      })
    );
    expect(result.messages).toEqual([]);
  });

  test("should update existing contact attributes", async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(mockContactData as any);
    const newAttributes = { email: "new@example.com", language: "en" };

    const result = await updateUser(mockEnvironmentId, mockUserId, "desktop", newAttributes);

    expect(updateAttributes).toHaveBeenCalledWith(
      mockContactId,
      mockUserId,
      mockEnvironmentId,
      newAttributes
    );
    expect(result.state.data?.language).toBe("en");
    expect(result.messages).toEqual([]);
  });

  test("should not update attributes if they are the same", async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(mockContactData as any);
    const existingAttributes = { email: "test@example.com" }; // Same as in mockContactData

    await updateUser(mockEnvironmentId, mockUserId, "desktop", existingAttributes);

    expect(updateAttributes).not.toHaveBeenCalled();
  });

  test("should return messages from updateAttributes if any", async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(mockContactData as any);
    const newAttributes = { company: "Formbricks" };
    const updateMessages = ["Attribute 'company' created."];
    vi.mocked(updateAttributes).mockResolvedValue({ success: true, messages: updateMessages });

    const result = await updateUser(mockEnvironmentId, mockUserId, "desktop", newAttributes);

    expect(updateAttributes).toHaveBeenCalledWith(
      mockContactId,
      mockUserId,
      mockEnvironmentId,
      newAttributes
    );
    expect(result.messages).toEqual(updateMessages);
  });

  test("should use device type 'phone'", async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(mockContactData as any);
    await updateUser(mockEnvironmentId, mockUserId, "phone");
    expect(getPersonSegmentIds).toHaveBeenCalledWith(
      mockEnvironmentId,
      mockContactId,
      mockUserId,
      { userId: mockUserId, email: "test@example.com" },
      "phone"
    );
  });

  test("should use device type 'desktop'", async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(mockContactData as any);
    await updateUser(mockEnvironmentId, mockUserId, "desktop");
    expect(getPersonSegmentIds).toHaveBeenCalledWith(
      mockEnvironmentId,
      mockContactId,
      mockUserId,
      { userId: mockUserId, email: "test@example.com" },
      "desktop"
    );
  });
});
