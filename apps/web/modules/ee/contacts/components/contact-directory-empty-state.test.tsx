import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ContactDirectoryEmptyState } from "./contact-directory-empty-state";

vi.mock("@/lingodotdev/server", () => ({
  getTranslate: async () => (key: string) => key,
}));

const ORG_ID = "clorg11111111111111111111";

describe("ContactDirectoryEmptyState", () => {
  afterEach(() => {
    cleanup();
  });

  test("links owners and managers to the organization's contact directories", async () => {
    render(await ContactDirectoryEmptyState({ organizationId: ORG_ID, isOwnerOrManager: true }));

    expect(
      screen.getByRole("heading", { name: "workspace.contacts.no_contact_directory_title" })
    ).toBeTruthy();
    expect(screen.getByText("workspace.contacts.no_contact_directory_admin_description")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "workspace.contacts.go_to_contact_directories" }).getAttribute("href")
    ).toBe(`/organizations/${ORG_ID}/settings/contact-directories`);
  });

  test("tells other members to ask an owner or manager, with no link", async () => {
    render(await ContactDirectoryEmptyState({ organizationId: ORG_ID, isOwnerOrManager: false }));

    expect(screen.getByText("workspace.contacts.no_contact_directory_member_description")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
