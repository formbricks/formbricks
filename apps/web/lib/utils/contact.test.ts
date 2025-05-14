import { describe, expect, test } from "vitest";
import { TContactAttributes } from "@formbricks/types/contact-attribute";
import { TResponseContact } from "@formbricks/types/responses";
import { getContactIdentifier } from "./contact";

describe("getContactIdentifier", () => {
  test("should return email from contactAttributes when available", () => {
    const contactAttributes: TContactAttributes = {
      email: "test@example.com",
    };
    const contact: TResponseContact = {
      id: "contact1",
      userId: "user123",
    };

    const result = getContactIdentifier(contact, contactAttributes);
    expect(result).toBe("test@example.com");
  });

  test("should return userId from contact when email is not available", () => {
    const contactAttributes: TContactAttributes = {};
    const contact: TResponseContact = {
      id: "contact2",
      userId: "user123",
    };

    const result = getContactIdentifier(contact, contactAttributes);
    expect(result).toBe("user123");
  });

  test("should return empty string when both email and userId are not available", () => {
    const contactAttributes: TContactAttributes = {};
    const contact: TResponseContact = {
      id: "contact3",
    };

    const result = getContactIdentifier(contact, contactAttributes);
    expect(result).toBe("");
  });

  test("should return empty string when both contact and contactAttributes are null", () => {
    const result = getContactIdentifier(null, null);
    expect(result).toBe("");
  });

  test("should return userId when contactAttributes is null", () => {
    const contact: TResponseContact = {
      id: "contact4",
      userId: "user123",
    };

    const result = getContactIdentifier(contact, null);
    expect(result).toBe("user123");
  });

  test("should return email when contact is null", () => {
    const contactAttributes: TContactAttributes = {
      email: "test@example.com",
    };

    const result = getContactIdentifier(null, contactAttributes);
    expect(result).toBe("test@example.com");
  });
});
