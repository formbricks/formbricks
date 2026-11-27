import { describe, expect, test } from "vitest";
import { toResultsResponseContact } from "./results-contact";

const contact = (directoryId: string | null) => ({
  id: "contact-1",
  directoryId,
  attributes: [
    { attributeKey: { key: "email" }, value: "ada@example.com" },
    { attributeKey: { key: "userId" }, value: "user-1" },
  ],
});

describe("toResultsResponseContact", () => {
  test("keeps the userId of a contact in the workspace's directory", () => {
    expect(toResultsResponseContact(contact("dir-a"), "dir-a")).toEqual({
      id: "contact-1",
      userId: "user-1",
    });
  });

  test("marks a contact of another directory unavailable, without its current userId", () => {
    expect(toResultsResponseContact(contact("dir-old"), "dir-new")).toEqual({
      id: "contact-1",
      unavailable: true,
    });
  });

  test("marks every contact unavailable when the workspace has no directory", () => {
    expect(toResultsResponseContact(contact("dir-a"), null)).toEqual({ id: "contact-1", unavailable: true });
    expect(toResultsResponseContact(contact(null), null)).toEqual({ id: "contact-1", unavailable: true });
  });

  test("is null for an anonymous response", () => {
    expect(toResultsResponseContact(null, "dir-a")).toBeNull();
  });
});
