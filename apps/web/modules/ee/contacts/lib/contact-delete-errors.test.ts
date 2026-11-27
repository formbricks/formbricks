import { describe, expect, test, vi } from "vitest";
import {
  CONTACT_IN_SHARED_DIRECTORY_ERROR_CODE,
  getTranslatedContactDeleteError,
} from "./contact-delete-errors";

describe("getTranslatedContactDeleteError", () => {
  const t = vi.fn((key: string) => `translated:${key}`) as never;

  test("translates the shared directory code", () => {
    expect(getTranslatedContactDeleteError(CONTACT_IN_SHARED_DIRECTORY_ERROR_CODE, t)).toBe(
      "translated:workspace.contacts.delete_contact_shared_directory"
    );
  });

  test("passes any other message through unchanged", () => {
    expect(getTranslatedContactDeleteError("Something else", t)).toBe("Something else");
  });
});
