import { ContactsPage } from "@/modules/ee/contacts/page";
import { describe, expect, test, vi } from "vitest";
import Page from "./page";

// Mock the actual ContactsPage component
vi.mock("@/modules/ee/contacts/page", () => ({
  ContactsPage: () => <div data-testid="contacts-page">Mock Contacts Page</div>,
}));

describe("Contacts Page Re-export", () => {
  test("should re-export ContactsPage from the EE module", () => {
    // Assert that the default export 'Page' is the same as the mocked 'ContactsPage'
    expect(Page).toBe(ContactsPage);
  });
});
