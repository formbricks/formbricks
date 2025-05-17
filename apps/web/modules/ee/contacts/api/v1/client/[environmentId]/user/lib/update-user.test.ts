import { contactCache } from "@/lib/cache/contact";
import { getEnvironment } from "@/lib/environment/service";
import { updateAttributes } from "@/modules/ee/contacts/lib/attributes";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { TEnvironment } from "@formbricks/types/environment";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { getContactByUserIdWithAttributes } from "./contact";
import { updateUser } from "./update-user";
import { getUserState } from "./user-state";

vi.mock("@/lib/cache/contact", () => ({
  contactCache: {
    revalidate: vi.fn(),
  },
}));

vi.mock("@/lib/environment/service", () => ({
  getEnvironment: vi.fn(),
}));

vi.mock("@/modules/ee/contacts/lib/attributes", () => ({
  updateAttributes: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    contact: {
      create: vi.fn(),
    },
  },
}));

vi.mock("./contact", () => ({
  getContactByUserIdWithAttributes: vi.fn(),
}));

vi.mock("./user-state", () => ({
  getUserState: vi.fn(),
}));

const mockEnvironmentId = "test-environment-id";
const mockUserId = "test-user-id";
const mockContactId = "test-contact-id";
const mockProjectId = "v7cxgsb4pzupdkr9xs14ldmb";

const mockEnvironment: TEnvironment = {
  id: mockEnvironmentId,
  createdAt: new Date(),
  updatedAt: new Date(),
  type: "production",
  appSetupCompleted: false,
  projectId: mockProjectId,
};

const mockContactAttributes = [
  { attributeKey: { key: "userId" }, value: mockUserId },
  { attributeKey: { key: "email" }, value: "test@example.com" },
];

const mockContact = {
  id: mockContactId,
  environmentId: mockEnvironmentId,
  attributes: mockContactAttributes,
  createdAt: new Date(),
  updatedAt: new Date(),
  name: null,
  email: null,
};

const mockUserState = {
  surveys: [],
  noCodeActionClasses: [],
  attributeClasses: [],
  contactId: mockContactId,
  userId: mockUserId,
  displays: [],
  responses: [],
  segments: [],
  lastDisplayAt: null,
};

describe("updateUser", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getEnvironment).mockResolvedValue(mockEnvironment);
    vi.mocked(getUserState).mockResolvedValue(mockUserState);
    vi.mocked(updateAttributes).mockResolvedValue({ success: true, messages: [] });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("should throw ResourceNotFoundError if environment is not found", async () => {
    vi.mocked(getEnvironment).mockResolvedValue(null);
    await expect(updateUser(mockEnvironmentId, mockUserId, "desktop")).rejects.toThrow(
      new ResourceNotFoundError("environment", mockEnvironmentId)
    );
  });

  test("should create a new contact if not found", async () => {
    vi.mocked(getContactByUserIdWithAttributes).mockResolvedValue(null);
    vi.mocked(prisma.contact.create).mockResolvedValue({
      id: mockContactId,
      attributes: [{ attributeKey: { key: "userId" }, value: mockUserId }],
    } as any); // Type assertion for mock

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
          select: { attributeKey: { select: { key: true } }, value: true },
        },
      },
    });
    expect(contactCache.revalidate).toHaveBeenCalledWith({
      environmentId: mockEnvironmentId,
      userId: mockUserId,
      id: mockContactId,
    });
    expect(result.state.data).toEqual(expect.objectContaining(mockUserState));
    expect(result.messages).toEqual([]);
  });

  test("should update existing contact attributes", async () => {
    vi.mocked(getContactByUserIdWithAttributes).mockResolvedValue(mockContact);
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
    vi.mocked(getContactByUserIdWithAttributes).mockResolvedValue(mockContact);
    const existingAttributes = { email: "test@example.com" }; // Same as in mockContact

    await updateUser(mockEnvironmentId, mockUserId, "desktop", existingAttributes);

    expect(updateAttributes).not.toHaveBeenCalled();
  });

  test("should return messages from updateAttributes if any", async () => {
    vi.mocked(getContactByUserIdWithAttributes).mockResolvedValue(mockContact);
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
    vi.mocked(getContactByUserIdWithAttributes).mockResolvedValue(mockContact);
    await updateUser(mockEnvironmentId, mockUserId, "phone");
    expect(getUserState).toHaveBeenCalledWith(
      expect.objectContaining({
        device: "phone",
      })
    );
  });

  test("should use device type 'desktop'", async () => {
    vi.mocked(getContactByUserIdWithAttributes).mockResolvedValue(mockContact);
    await updateUser(mockEnvironmentId, mockUserId, "desktop");
    expect(getUserState).toHaveBeenCalledWith(
      expect.objectContaining({
        device: "desktop",
      })
    );
  });

  test("should set language from attributes if provided and update is successful", async () => {
    vi.mocked(getContactByUserIdWithAttributes).mockResolvedValue(mockContact);
    const newAttributes = { language: "de" };
    vi.mocked(updateAttributes).mockResolvedValue({ success: true, messages: [] });

    const result = await updateUser(mockEnvironmentId, mockUserId, "desktop", newAttributes);

    expect(result.state.data?.language).toBe("de");
  });

  test("should not set language from attributes if update is not successful", async () => {
    const initialContactWithLanguage = {
      ...mockContact,
      attributes: [...mockContact.attributes, { attributeKey: { key: "language" }, value: "fr" }],
    };
    vi.mocked(getContactByUserIdWithAttributes).mockResolvedValue(initialContactWithLanguage);
    const newAttributes = { language: "de" };
    vi.mocked(updateAttributes).mockResolvedValue({ success: false, messages: ["Update failed"] });

    const result = await updateUser(mockEnvironmentId, mockUserId, "desktop", newAttributes);

    // Language should remain 'fr' from the initial contact attributes, not 'de'
    expect(result.state.data?.language).toBe("fr");
  });

  test("should handle empty attributes object", async () => {
    vi.mocked(getContactByUserIdWithAttributes).mockResolvedValue(mockContact);
    const result = await updateUser(mockEnvironmentId, mockUserId, "desktop", {});
    expect(updateAttributes).not.toHaveBeenCalled();
    expect(result.state.data).toEqual(expect.objectContaining(mockUserState));
    expect(result.messages).toEqual([]);
  });

  test("should handle undefined attributes", async () => {
    vi.mocked(getContactByUserIdWithAttributes).mockResolvedValue(mockContact);
    const result = await updateUser(mockEnvironmentId, mockUserId, "desktop", undefined);
    expect(updateAttributes).not.toHaveBeenCalled();
    expect(result.state.data).toEqual(expect.objectContaining(mockUserState));
    expect(result.messages).toEqual([]);
  });

  test("should handle email attribute update with ignoreEmailAttribute flag", async () => {
    vi.mocked(getContactByUserIdWithAttributes).mockResolvedValue(mockContact);
    const newAttributes = { email: "new@example.com", name: "John Doe" };
    vi.mocked(updateAttributes).mockResolvedValue({
      success: true,
      messages: [],
      ignoreEmailAttribute: true,
    });

    vi.mocked(getUserState).mockResolvedValue({
      ...mockUserState,
    });

    const result = await updateUser(mockEnvironmentId, mockUserId, "desktop", newAttributes);

    expect(updateAttributes).toHaveBeenCalledWith(
      mockContactId,
      mockUserId,
      mockEnvironmentId,
      newAttributes
    );
    // Email should not be included in the final attributes
    expect(result.state.data).toEqual(
      expect.objectContaining({
        ...mockUserState,
      })
    );
  });

  test("should handle failed attribute update gracefully", async () => {
    vi.mocked(getContactByUserIdWithAttributes).mockResolvedValue(mockContact);
    const newAttributes = { company: "Formbricks" };
    vi.mocked(updateAttributes).mockResolvedValue({
      success: false,
      messages: ["Update failed"],
    });

    const result = await updateUser(mockEnvironmentId, mockUserId, "desktop", newAttributes);

    expect(updateAttributes).toHaveBeenCalledWith(
      mockContactId,
      mockUserId,
      mockEnvironmentId,
      newAttributes
    );
    // Should still return state even if update failed
    expect(result.state.data).toEqual(expect.objectContaining(mockUserState));
    expect(result.messages).toEqual(["Update failed"]);
  });

  test("should handle multiple attribute updates correctly", async () => {
    vi.mocked(getContactByUserIdWithAttributes).mockResolvedValue(mockContact);
    const newAttributes = {
      company: "Formbricks",
      role: "Developer",
      language: "en",
      country: "US",
    };
    vi.mocked(updateAttributes).mockResolvedValue({
      success: true,
      messages: ["Attributes updated successfully"],
    });

    const result = await updateUser(mockEnvironmentId, mockUserId, "desktop", newAttributes);

    expect(updateAttributes).toHaveBeenCalledWith(
      mockContactId,
      mockUserId,
      mockEnvironmentId,
      newAttributes
    );
    expect(result.state.data?.language).toBe("en");
    expect(result.messages).toEqual(["Attributes updated successfully"]);
  });

  test("should handle contact creation with multiple initial attributes", async () => {
    vi.mocked(getContactByUserIdWithAttributes).mockResolvedValue(null);
    const initialAttributes = {
      userId: mockUserId,
      email: "test@example.com",
      name: "Test User",
    };
    vi.mocked(prisma.contact.create).mockResolvedValue({
      id: mockContactId,
      attributes: [
        { attributeKey: { key: "userId" }, value: mockUserId },
        { attributeKey: { key: "email" }, value: "test@example.com" },
        { attributeKey: { key: "name" }, value: "Test User" },
      ],
    } as any);

    const result = await updateUser(mockEnvironmentId, mockUserId, "desktop", initialAttributes);

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
          select: { attributeKey: { select: { key: true } }, value: true },
        },
      },
    });
    expect(contactCache.revalidate).toHaveBeenCalledWith({
      environmentId: mockEnvironmentId,
      userId: mockUserId,
      id: mockContactId,
    });
    expect(result.state.data).toEqual(expect.objectContaining(mockUserState));
  });
});
