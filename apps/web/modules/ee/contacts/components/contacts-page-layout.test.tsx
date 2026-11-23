import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ContactsPageLayout } from "./contacts-page-layout";

vi.mock("@/lingodotdev/server", () => ({
  getTranslate: async () => (key: string) => key,
}));

vi.mock("@/lib/constants", () => ({
  ENTERPRISE_LICENSE_REQUEST_FORM_URL: "https://example.com/license",
  IS_FORMBRICKS_CLOUD: false,
}));

vi.mock("@/modules/ui/components/upgrade-prompt", () => ({
  UpgradePrompt: () => <p>upgrade prompt</p>,
}));

vi.mock("./contacts-secondary-navigation", () => ({
  ContactsSecondaryNavigation: () => null,
}));

vi.mock("./contact-directory-empty-state", () => ({
  ContactDirectoryEmptyState: ({ isOwnerOrManager }: Readonly<{ isOwnerOrManager: boolean }>) => (
    <p>{isOwnerOrManager ? "no-directory:admin" : "no-directory:member"}</p>
  ),
}));

const renderLayout = async (hasContactDirectory: boolean) =>
  render(
    await ContactsPageLayout({
      pageTitle: "Contacts",
      activeId: "contacts",
      workspaceId: "clworkspace00000000000001",
      organizationId: "clorg11111111111111111111",
      isContactsEnabled: true,
      isReadOnly: false,
      hasContactDirectory,
      isOwnerOrManager: true,
      cta: <button type="button">Upload CSV</button>,
      children: <p>contact table</p>,
    })
  );

describe("ContactsPageLayout", () => {
  afterEach(() => {
    cleanup();
  });

  test("shows the no-directory state instead of the page, and keeps the header action", async () => {
    await renderLayout(false);

    expect(screen.getByText("no-directory:admin")).toBeTruthy();
    expect(screen.queryByText("contact table")).toBeNull();
    expect(screen.getByRole("button", { name: "Upload CSV" })).toBeTruthy();
  });

  test("shows the page when the workspace has a contact directory", async () => {
    await renderLayout(true);

    expect(screen.getByText("contact table")).toBeTruthy();
    expect(screen.queryByText("no-directory:admin")).toBeNull();
  });
});
