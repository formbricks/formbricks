import { beforeEach, describe, expect, it, vi } from "vitest";
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

  it("should update contact attributes successfully", async () => {
    const contactId = "contact123";
    const environmentId = "env123";
    const userId = "user123";
    const attributes = {
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
      { id: "key1", key: "firstName", name: "First Name", environmentId },
      { id: "key2", key: "lastName", name: "Last Name", environmentId },
      { id: "key3", key: "email", name: "Email", environmentId },
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
    expect(updateAttributes).toHaveBeenCalledWith(contactId, userId, environmentId, attributes);
    expect(getContactAttributes).toHaveBeenCalledWith(contactId);
    expect(result.updatedAttributes).toEqual(mockUpdatedAttributes);
    expect(result.updatedAttributeKeys).toBeUndefined();
  });

  it("should detect new attribute keys when created", async () => {
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

    const mockCurrentKeys = [{ id: "key1", key: "firstName", name: "First Name", environmentId }];
    const mockUpdatedKeys = [
      { id: "key1", key: "firstName", name: "First Name", environmentId },
      { id: "key2", key: "newCustomField", name: "newCustomField", environmentId },
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
      { id: "key2", key: "newCustomField", name: "newCustomField", environmentId },
    ]);
  });

  it("should handle missing userId with warning message", async () => {
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

    const mockCurrentKeys = [{ id: "key1", key: "firstName", name: "First Name", environmentId }];
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

    expect(updateAttributes).toHaveBeenCalledWith(contactId, "", environmentId, attributes);
    expect(result.messages).toContain(
      "Warning: userId attribute is missing. Some operations may not work correctly."
    );
  });

  it("should merge messages from updateAttributes", async () => {
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

    const mockCurrentKeys = [{ id: "key1", key: "email", name: "Email", environmentId }];
    const mockUpdatedAttributes = {
      email: "existing@example.com",
    };

    vi.mocked(getContact).mockResolvedValue(mockContact as any);
    vi.mocked(getContactAttributeKeys).mockResolvedValueOnce(mockCurrentKeys);
    vi.mocked(updateAttributes).mockResolvedValue({
      success: true,
      messages: ["The email already exists for this environment and was not updated."],
    });
    vi.mocked(getContactAttributes).mockResolvedValue(mockUpdatedAttributes);
    vi.mocked(getContactAttributeKeys).mockResolvedValueOnce(mockCurrentKeys);

    const result = await updateContactAttributes(contactId, attributes);

    expect(result.messages).toContain("The email already exists for this environment and was not updated.");
  });

  it("should throw error if contact not found", async () => {
    const contactId = "contact123";
    const attributes = {
      firstName: "John",
    };

    vi.mocked(getContact).mockResolvedValue(null);

    await expect(updateContactAttributes(contactId, attributes)).rejects.toThrow("Contact not found");
  });
});
