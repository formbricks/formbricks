import { beforeEach, describe, expect, test, vi } from "vitest";
import { updateAttributes } from "./attributes";
import { getContactAttributeKeys } from "./contact-attribute-keys";
import { getContactAttributes } from "./contact-attributes";
import { getContact } from "./contacts";
import { updateContactAttributes } from "./update-contact-attributes";

// Mock dependencies
vi.mock("./contacts");
vi.mock("./contact-attributes");
vi.mock("./contact-attribute-keys");
vi.mock("./attributes");

describe("updateContactAttributes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should update contact attributes with deleteRemovedAttributes: true", async () => {
    const contactId = "contact123";
    const environmentId = "env123";
    const userId = "user123";
    const attributes = {
      userId,
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
    };

    const mockContact = {
      id: contactId,
      environmentId,
      attributes: {
        userId,
        firstName: "Jane",
        lastName: "Smith",
      },
    };

    const mockCurrentKeys = [
      {
        id: "key1",
        key: "firstName",
        name: "First Name",
        environmentId,
        createdAt: new Date(),
        updatedAt: new Date(),
        type: "default" as const,
        isUnique: false,
        description: null,
      },
      {
        id: "key2",
        key: "lastName",
        name: "Last Name",
        environmentId,
        createdAt: new Date(),
        updatedAt: new Date(),
        type: "default" as const,
        isUnique: false,
        description: null,
      },
      {
        id: "key3",
        key: "email",
        name: "Email",
        environmentId,
        createdAt: new Date(),
        updatedAt: new Date(),
        type: "default" as const,
        isUnique: false,
        description: null,
      },
    ];

    const mockUpdatedAttributes = {
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
    };

    vi.mocked(getContact).mockResolvedValue(mockContact as any);
    vi.mocked(getContactAttributeKeys).mockResolvedValueOnce(mockCurrentKeys);
    vi.mocked(updateAttributes).mockResolvedValue({
      success: true,
    });
    vi.mocked(getContactAttributes).mockResolvedValue(mockUpdatedAttributes);
    vi.mocked(getContactAttributeKeys).mockResolvedValueOnce(mockCurrentKeys);

    const result = await updateContactAttributes(contactId, attributes);

    expect(getContact).toHaveBeenCalledWith(contactId);
    expect(getContactAttributeKeys).toHaveBeenCalledWith(environmentId);
    // Should call updateAttributes with deleteRemovedAttributes: true for UI form updates
    expect(updateAttributes).toHaveBeenCalledWith(contactId, userId, environmentId, attributes, true);
    expect(getContactAttributes).toHaveBeenCalledWith(contactId);
    expect(result.updatedAttributes).toEqual(mockUpdatedAttributes);
    expect(result.updatedAttributeKeys).toBeUndefined();
  });

  test("should detect new attribute keys when created", async () => {
    const contactId = "contact123";
    const environmentId = "env123";
    const userId = "user123";
    const attributes = {
      firstName: "John",
      newCustomField: "custom value",
    };

    const mockContact = {
      id: contactId,
      environmentId,
      attributes: {
        userId,
        firstName: "Jane",
      },
    };

    const mockCurrentKeys = [
      {
        id: "key1",
        key: "firstName",
        name: "First Name",
        environmentId,
        createdAt: new Date(),
        updatedAt: new Date(),
        type: "default" as const,
        isUnique: false,
        description: null,
      },
    ];
    const mockUpdatedKeys = [
      {
        id: "key1",
        key: "firstName",
        name: "First Name",
        environmentId,
        createdAt: new Date(),
        updatedAt: new Date(),
        type: "default" as const,
        isUnique: false,
        description: null,
      },
      {
        id: "key2",
        key: "newCustomField",
        name: "newCustomField",
        environmentId,
        createdAt: new Date(),
        updatedAt: new Date(),
        type: "custom" as const,
        isUnique: false,
        description: null,
      },
    ];

    const mockUpdatedAttributes = {
      firstName: "John",
      newCustomField: "custom value",
    };

    vi.mocked(getContact).mockResolvedValue(mockContact as any);
    vi.mocked(getContactAttributeKeys).mockResolvedValueOnce(mockCurrentKeys);
    vi.mocked(updateAttributes).mockResolvedValue({
      success: true,
    });
    vi.mocked(getContactAttributes).mockResolvedValue(mockUpdatedAttributes);
    vi.mocked(getContactAttributeKeys).mockResolvedValueOnce(mockUpdatedKeys);

    const result = await updateContactAttributes(contactId, attributes);

    expect(result.updatedAttributes).toEqual(mockUpdatedAttributes);
    expect(result.updatedAttributeKeys).toEqual([
      {
        id: "key2",
        key: "newCustomField",
        name: "newCustomField",
        environmentId,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        type: "custom",
        isUnique: false,
        description: null,
      },
    ]);
  });

  test("should handle missing userId gracefully", async () => {
    const contactId = "contact123";
    const environmentId = "env123";
    const attributes = {
      firstName: "John",
    };

    const mockContact = {
      id: contactId,
      environmentId,
      attributes: {
        firstName: "Jane",
      },
    };

    const mockCurrentKeys = [
      {
        id: "key1",
        key: "firstName",
        name: "First Name",
        environmentId,
        createdAt: new Date(),
        updatedAt: new Date(),
        type: "default" as const,
        isUnique: false,
        description: null,
      },
    ];
    const mockUpdatedAttributes = {
      firstName: "John",
    };

    vi.mocked(getContact).mockResolvedValue(mockContact as any);
    vi.mocked(getContactAttributeKeys).mockResolvedValueOnce(mockCurrentKeys);
    vi.mocked(updateAttributes).mockResolvedValue({
      success: true,
    });
    vi.mocked(getContactAttributes).mockResolvedValue(mockUpdatedAttributes);
    vi.mocked(getContactAttributeKeys).mockResolvedValueOnce(mockCurrentKeys);

    const result = await updateContactAttributes(contactId, attributes);

    // When userId is not in attributes, pass empty string to updateAttributes
    expect(updateAttributes).toHaveBeenCalledWith(contactId, "", environmentId, attributes, true);
    // No warning message - the backend now gracefully handles missing userId by keeping current value
    expect(result.messages).toBeUndefined();
  });

  test("should merge messages from updateAttributes", async () => {
    const contactId = "contact123";
    const environmentId = "env123";
    const userId = "user123";
    const attributes = {
      email: "existing@example.com",
    };

    const mockContact = {
      id: contactId,
      environmentId,
      attributes: {
        userId,
      },
    };

    const mockCurrentKeys = [
      {
        id: "key1",
        key: "email",
        name: "Email",
        environmentId,
        createdAt: new Date(),
        updatedAt: new Date(),
        type: "default" as const,
        isUnique: false,
        description: null,
      },
    ];
    const mockUpdatedAttributes = {
      email: "existing@example.com",
    };

    vi.mocked(getContact).mockResolvedValue(mockContact as any);
    vi.mocked(getContactAttributeKeys).mockResolvedValueOnce(mockCurrentKeys);
    vi.mocked(updateAttributes).mockResolvedValue({
      success: true,
      messages: [{ code: "email_already_exists", params: {} }],
    });
    vi.mocked(getContactAttributes).mockResolvedValue(mockUpdatedAttributes);
    vi.mocked(getContactAttributeKeys).mockResolvedValueOnce(mockCurrentKeys);

    const result = await updateContactAttributes(contactId, attributes);

    expect(result.messages).toContainEqual({ code: "email_already_exists", params: {} });
  });

  test("should throw error if contact not found", async () => {
    const contactId = "contact123";
    const attributes = {
      firstName: "John",
    };

    vi.mocked(getContact).mockResolvedValue(null);

    await expect(updateContactAttributes(contactId, attributes)).rejects.toThrow(
      "contact with ID contact123 not found"
    );
  });
});
